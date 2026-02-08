package main

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/inconshreveable/go-update"
)

// App struct
type App struct {
	ctx      context.Context
	vlinkMu  sync.Mutex
	vlinkCmd *exec.Cmd
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// StartVlink starts the vlink process with the configured file.
func (a *App) StartVlink() (string, error) {
	a.vlinkMu.Lock()
	defer a.vlinkMu.Unlock()

	if a.vlinkCmd != nil && a.vlinkCmd.Process != nil {
		return "vlink is already running", nil
	}

	configPath := "/etc/vlink/config.json"
	if homeDir, err := os.UserHomeDir(); err == nil {
		homeConfig := filepath.Join(homeDir, ".vlink", "config.json")
		if _, err := os.Stat(homeConfig); err == nil {
			configPath = "/etc/vlink/config.json"
		}
	}

	cmd := exec.Command("/usr/local/bin/vlink", "-config", configPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return "failed to start vlink", err
	}

	a.vlinkCmd = cmd
	go func() {
		_ = cmd.Wait()
		a.vlinkMu.Lock()
		defer a.vlinkMu.Unlock()
		if a.vlinkCmd == cmd {
			a.vlinkCmd = nil
		}
	}()

	return "vlink started", nil
}

// StopVlink stops the running vlink process.
func (a *App) StopVlink() (string, error) {
	a.vlinkMu.Lock()
	defer a.vlinkMu.Unlock()

	if a.vlinkCmd == nil || a.vlinkCmd.Process == nil {
		return "vlink is not running", nil
	}

	_ = a.vlinkCmd.Process.Signal(os.Interrupt)

	waitCh := make(chan error, 1)
	go func(cmd *exec.Cmd) {
		waitCh <- cmd.Wait()
	}(a.vlinkCmd)

	select {
	case <-time.After(3 * time.Second):
		_ = a.vlinkCmd.Process.Kill()
		_ = a.vlinkCmd.Wait()
	case <-waitCh:
	}

	a.vlinkCmd = nil
	return "vlink stopped", nil
}

// IsVlinkPortAlive checks if 127.0.0.1:1080 is accepting TCP connections.
func (a *App) IsVlinkPortAlive() bool {
	conn, err := net.DialTimeout("tcp", "127.0.0.1:1080", 500*time.Millisecond)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}

// ChatWithGemini sends prompt to Gemini CLI using yolo mode.
func (a *App) ChatWithGemini(prompt string) (string, error) {
	trimmed := strings.TrimSpace(prompt)
	if trimmed == "" {
		return "", nil
	}
	return a.ChatWithGeminiWithAttachments(trimmed, nil)
}

type GeminiAttachment struct {
	Name     string `json:"name"`
	Content  string `json:"content"`
	IsBinary bool   `json:"isBinary"`
}

// ChatWithGeminiWithAttachments sends prompt and attachments to Gemini CLI using yolo mode.
func (a *App) ChatWithGeminiWithAttachments(prompt string, attachments []GeminiAttachment) (string, error) {
	trimmed := strings.TrimSpace(prompt)
	if trimmed == "" {
		return "", nil
	}

	var combined strings.Builder
	combined.WriteString(trimmed)

	if len(attachments) > 0 {
		combined.WriteString("\n\nAttachments:\n")
		for _, attachment := range attachments {
			name := strings.TrimSpace(attachment.Name)
			content := strings.TrimSpace(attachment.Content)
			if name == "" || content == "" {
				continue
			}
			if attachment.IsBinary {
				combined.WriteString(fmt.Sprintf("- %s (base64)\n", name))
				combined.WriteString(content)
				combined.WriteString("\n")
			} else {
				combined.WriteString(fmt.Sprintf("- %s\n", name))
				combined.WriteString("```\n")
				combined.WriteString(content)
				combined.WriteString("\n```\n")
			}
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "gemini", "chat", "--yolo")
	cmd.Stdin = strings.NewReader(combined.String())
	finalHTTPProxy := "http://127.0.0.1:8118"
	env := append([]string{}, os.Environ()...)
	env = append(env, fmt.Sprintf("HTTP_PROXY=%s", finalHTTPProxy))
	env = append(env, fmt.Sprintf("HTTPS_PROXY=%s", finalHTTPProxy))
	cmd.Env = env

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("gemini cli timeout")
		}
		errMsg := strings.TrimSpace(stderr.String())
		if errMsg == "" {
			errMsg = err.Error()
		}
		return "", fmt.Errorf("gemini cli error: %s", errMsg)
	}

	output := strings.TrimSpace(stdout.String())
	if output == "" {
		return "", fmt.Errorf("gemini cli returned empty response")
	}
	return output, nil
}

// SelfUpdate downloads and applies the latest archive from the downloads directory.
// It expects GoReleaser archive naming: tars-copilot_<version>_<os>_<arch>.(tar.gz|zip).
func (a *App) SelfUpdate() (string, error) {
	return a.SelfUpdateFromArchive("latest")
}

// SelfUpdateFromArchive downloads and applies an update for the given version.
// If version is empty, "latest" is used.
func (a *App) SelfUpdateFromArchive(version string) (string, error) {
	baseURL := "https://qtopie.space/downloads/"
	finalVersion := strings.TrimSpace(version)
	if finalVersion == "" {
		finalVersion = "latest"
	}
	fileName := buildArchiveFileName(finalVersion)
	if fileName == "" {
		return "", fmt.Errorf("unsupported platform for update")
	}
	url := baseURL + fileName

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "", fmt.Errorf("failed to download update: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("update download failed: %s", resp.Status)
	}

	archiveData, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read update: %w", err)
	}

	binaryData, err := extractBinaryFromArchive(archiveData)
	if err != nil {
		return "", err
	}

	if err := update.Apply(bytes.NewReader(binaryData), update.Options{}); err != nil {
		if rollbackErr := update.RollbackError(err); rollbackErr != nil {
			return "", fmt.Errorf("update failed and rollback failed: %v", rollbackErr)
		}
		return "", fmt.Errorf("update failed: %w", err)
	}

	return "update applied, please restart the app", nil
}

func buildArchiveFileName(version string) string {
	name := "tars-copilot"
	goos := runtime.GOOS
	goarch := runtime.GOARCH
	if goos == "windows" {
		return fmt.Sprintf("%s_%s_%s_%s.zip", name, version, goos, goarch)
	}
	return fmt.Sprintf("%s_%s_%s_%s.tar.gz", name, version, goos, goarch)
}

func extractBinaryFromArchive(data []byte) ([]byte, error) {
	expected := "tars-copilot"
	if runtime.GOOS == "windows" {
		expected = "tars-copilot.exe"
	}

	if runtime.GOOS == "windows" {
		return extractFromZip(data, expected)
	}
	return extractFromTarGz(data, expected)
}

func extractFromZip(data []byte, expected string) ([]byte, error) {
	readerAt := bytes.NewReader(data)
	zipReader, err := zip.NewReader(readerAt, int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("failed to open zip: %w", err)
	}
	for _, file := range zipReader.File {
		if filepath.Base(file.Name) != expected {
			continue
		}
		if file.FileInfo().IsDir() {
			continue
		}
		rc, err := file.Open()
		if err != nil {
			return nil, fmt.Errorf("failed to read zip entry: %w", err)
		}
		defer rc.Close()
		return io.ReadAll(rc)
	}
	return nil, fmt.Errorf("binary %s not found in zip", expected)
}

func extractFromTarGz(data []byte, expected string) ([]byte, error) {
	gzReader, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to open gzip: %w", err)
	}
	defer gzReader.Close()

	tarReader := tar.NewReader(gzReader)
	for {
		hdr, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to read tar: %w", err)
		}
		if hdr.Typeflag != tar.TypeReg {
			continue
		}
		if filepath.Base(hdr.Name) != expected {
			continue
		}
		return io.ReadAll(tarReader)
	}
	return nil, fmt.Errorf("binary %s not found in archive", expected)
}

func (a *App) IsVlinkInstalled() bool {
	if runtime.GOOS == "windows" {
		return false
	}
	_, err := os.Stat("/usr/local/bin/vlink")
	return err == nil
}

func (a *App) InstallVlink(version string, sudoPassword string) (string, error) {
	if runtime.GOOS == "windows" {
		return "", fmt.Errorf("vlink install is not supported on Windows")
	}
	trimmedPassword := strings.TrimSpace(sudoPassword)
	if trimmedPassword == "" {
		return "", fmt.Errorf("sudo password is required")
	}

	binaryData, err := downloadVlinkBinary(version)
	if err != nil {
		return "", err
	}

	tmpFile, err := os.CreateTemp("", "vlink-*")
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.Write(binaryData); err != nil {
		_ = tmpFile.Close()
		return "", fmt.Errorf("failed to write temp file: %w", err)
	}
	if err := tmpFile.Close(); err != nil {
		return "", fmt.Errorf("failed to close temp file: %w", err)
	}

	installCmd := exec.Command("sudo", "-S", "install", "-m", "0755", tmpFile.Name(), "/usr/local/bin/vlink")
	installCmd.Stdin = strings.NewReader(trimmedPassword + "\n")
	output, err := installCmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("install failed: %s", strings.TrimSpace(string(output)))
	}

	return "vlink installed", nil
}

func downloadVlinkBinary(version string) ([]byte, error) {
	baseURL := "https://qtopie.space/downloads/"
	finalVersion := strings.TrimSpace(version)
	if finalVersion == "" {
		finalVersion = "latest"
	}
	fileName := buildVlinkArchiveFileName(finalVersion)
	if fileName == "" {
		return nil, fmt.Errorf("unsupported platform for vlink")
	}
	url := baseURL + fileName

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to download vlink: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("vlink download failed: %s", resp.Status)
	}

	archiveData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read vlink archive: %w", err)
	}

	expected := "vlink"
	if runtime.GOOS == "windows" {
		expected = "vlink.exe"
	}

	if runtime.GOOS == "windows" {
		return extractFromZip(archiveData, expected)
	}
	return extractFromTarGz(archiveData, expected)
}

func buildVlinkArchiveFileName(version string) string {
	name := "vlink"
	goos := runtime.GOOS
	goarch := runtime.GOARCH
	if goos == "windows" {
		return fmt.Sprintf("%s_%s_%s_%s.zip", name, version, goos, goarch)
	}
	return fmt.Sprintf("%s_%s_%s_%s.tar.gz", name, version, goos, goarch)
}
