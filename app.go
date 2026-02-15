package main

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
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
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx      context.Context
	vlinkMu  sync.Mutex
	vlinkCmd *exec.Cmd
	settingsMu sync.Mutex
	settings   AppSettings
}

type AppSettings struct {
	DisplayName   string `json:"displayName"`
	AutoUpdate    bool   `json:"autoUpdate"`
	VlinkAutoStart bool  `json:"vlinkAutoStart"`
	Notes         string `json:"notes"`
	PomodoroNotifyDesktop bool `json:"pomodoroNotifyDesktop"`
	PomodoroNotifySound   bool `json:"pomodoroNotifySound"`
}

type VlinkConfig struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

var appVersion = "dev"

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	settings, err := loadSettingsFromDisk()
	if err != nil {
		settings = defaultSettings()
		_ = saveSettingsToDisk(settings)
	}
	a.settingsMu.Lock()
	a.settings = settings
	a.settingsMu.Unlock()
}

// About returns app info for About dialog
func (a *App) About() string {
	return fmt.Sprintf("A smart assistant.\nVersion: %s\n\nMade with ♥ in Guangzhou by ©qtopie 2026.", appVersion)
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

func (a *App) GetSettings() AppSettings {
	a.settingsMu.Lock()
	defer a.settingsMu.Unlock()
	return a.settings
}

func (a *App) SaveSettings(next AppSettings) (string, error) {
	a.settingsMu.Lock()
	a.settings = next
	a.settingsMu.Unlock()

	if err := saveSettingsToDisk(next); err != nil {
		return "", err
	}
	return "settings saved", nil
}

func defaultSettings() AppSettings {
	return AppSettings{
		DisplayName:   "Domour Copilot",
		AutoUpdate:    true,
		VlinkAutoStart: false,
		Notes:         "",
		PomodoroNotifyDesktop: true,
		PomodoroNotifySound:   false,
	}
}

func settingsFilePath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(homeDir, ".domour", "cosmos-assistant.json"), nil
}

func loadSettingsFromDisk() (AppSettings, error) {
	path, err := settingsFilePath()
	if err != nil {
		return AppSettings{}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return AppSettings{}, err
	}
	var settings AppSettings
	if err := json.Unmarshal(data, &settings); err != nil {
		return AppSettings{}, err
	}
	return settings, nil
}

func saveSettingsToDisk(settings AppSettings) error {
	path, err := settingsFilePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

func vlinkBinaryPath() (string, error) {
	if runtime.GOOS == "windows" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(homeDir, ".vlink", "vlink.exe"), nil
	}
	return "/usr/local/bin/vlink", nil
}

func vlinkHomeConfigPath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(homeDir, ".vlink", "config.json"), nil
}

func vlinkConfigExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func defaultVlinkConfigContent() string {
	return "{}\n"
}

func ensureVlinkHomeConfig() (string, bool, error) {
	homeConfig, err := vlinkHomeConfigPath()
	if err != nil {
		return "", false, err
	}
	if vlinkConfigExists(homeConfig) {
		return homeConfig, false, nil
	}
	if err := os.MkdirAll(filepath.Dir(homeConfig), 0o755); err != nil {
		return "", false, err
	}
	if err := os.WriteFile(homeConfig, []byte(defaultVlinkConfigContent()), 0o600); err != nil {
		return "", false, err
	}
	return homeConfig, true, nil
}

func resolveVlinkConfigPath() (string, bool, error) {
	homeConfig, err := vlinkHomeConfigPath()
	if err != nil {
		return "", false, err
	}
	if vlinkConfigExists(homeConfig) {
		return homeConfig, false, nil
	}
	if runtime.GOOS != "windows" {
		systemConfig := "/etc/vlink/config.json"
		if vlinkConfigExists(systemConfig) {
			return systemConfig, false, nil
		}
	}
	return ensureVlinkHomeConfig()
}

// StartVlink starts the vlink process with the configured file.
func (a *App) StartVlink() (string, error) {
	a.vlinkMu.Lock()
	defer a.vlinkMu.Unlock()

	if a.vlinkCmd != nil && a.vlinkCmd.Process != nil {
		return "vlink is already running", nil
	}

	binaryPath, err := vlinkBinaryPath()
	if err != nil {
		return "failed to locate vlink", err
	}
	configPath, created, err := resolveVlinkConfigPath()
	if err != nil {
		return "failed to resolve vlink config", err
	}
	if created {
		a.emitVlinkConfigRequired(configPath)
		return "vlink config required", fmt.Errorf("vlink config required")
	}
	args := []string{}
	if configPath != "" {
		args = append(args, "-config", configPath)
	}

	cmd := exec.Command(binaryPath, args...)
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

func (a *App) GetVlinkConfig() (VlinkConfig, error) {
	path, _, err := ensureVlinkHomeConfig()
	if err != nil {
		return VlinkConfig{}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return VlinkConfig{}, err
	}
	return VlinkConfig{Path: path, Content: string(data)}, nil
}

func (a *App) SaveVlinkConfig(content string) (string, error) {
	path, _, err := ensureVlinkHomeConfig()
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		return "", err
	}
	return "vlink config saved", nil
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
// It expects GoReleaser archive naming: domour-copilot_<version>_<os>_<arch>.(tar.gz|zip).
func (a *App) SelfUpdate() (string, error) {
	return a.SelfUpdateFromArchive("latest")
}

// SelfUpdateFromArchive downloads and applies an update for the given version.
// If version is empty, "latest" is used.
func (a *App) SelfUpdateFromArchive(version string) (string, error) {
	baseURL := "https://qtopie.space/downloads/domour/"
	finalVersion := strings.TrimSpace(version)
	if finalVersion == "" || finalVersion == "latest" {
		latest, err := fetchLatestVersionFromChecksums(baseURL, "domour-copilot")
		if err != nil {
			return "", err
		}
		finalVersion = latest
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
	name := "domour-copilot"
	goos := runtime.GOOS
	goarch := runtime.GOARCH
	if goos == "windows" {
		return fmt.Sprintf("%s_%s_%s_%s.zip", name, version, goos, goarch)
	}
	return fmt.Sprintf("%s_%s_%s_%s.tar.gz", name, version, goos, goarch)
}

func extractBinaryFromArchive(data []byte) ([]byte, error) {
	expected := "domour-copilot"
	if runtime.GOOS == "windows" {
		expected = "domour-copilot.exe"
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
	binaryPath, err := vlinkBinaryPath()
	if err != nil {
		return false
	}
	_, err = os.Stat(binaryPath)
	return err == nil
}

func (a *App) InstallVlink(version string, sudoPassword string) (string, error) {
	if runtime.GOOS == "windows" {
		return a.installVlinkForWindows(version)
	}
	trimmedPassword := strings.TrimSpace(sudoPassword)
	if trimmedPassword == "" {
		return "", fmt.Errorf("sudo password is required")
	}

	a.emitVlinkInstallStatus("开始安装 vlink")

	binaryData, err := downloadVlinkBinary(version)
	if err != nil {
		a.emitVlinkInstallStatus("vlink 下载失败")
		return "", err
	}
	a.emitVlinkInstallStatus("vlink 下载完成")

	tmpFile, err := os.CreateTemp("", "vlink-*")
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.Write(binaryData); err != nil {
		_ = tmpFile.Close()
		a.emitVlinkInstallStatus("写入临时文件失败")
		return "", fmt.Errorf("failed to write temp file: %w", err)
	}
	if err := tmpFile.Close(); err != nil {
		a.emitVlinkInstallStatus("写入临时文件失败")
		return "", fmt.Errorf("failed to close temp file: %w", err)
	}

	a.emitVlinkInstallStatus("正在写入 /usr/local/bin/vlink（需要 sudo 授权）")
	installCmd := exec.Command("sudo", "-S", "install", "-m", "0755", tmpFile.Name(), "/usr/local/bin/vlink")
	installCmd.Stdin = strings.NewReader(trimmedPassword + "\n")
	output, err := installCmd.CombinedOutput()
	if err != nil {
		a.emitVlinkInstallStatus("安装失败")
		return "", fmt.Errorf("install failed: %s", strings.TrimSpace(string(output)))
	}

	a.emitVlinkInstallStatus("安装完成")
	return "vlink installed", nil
}

func (a *App) installVlinkForWindows(version string) (string, error) {
	a.emitVlinkInstallStatus("开始安装 vlink")

	binaryData, err := downloadVlinkBinary(version)
	if err != nil {
		a.emitVlinkInstallStatus("vlink 下载失败")
		return "", err
	}
	a.emitVlinkInstallStatus("vlink 下载完成")

	binaryPath, err := vlinkBinaryPath()
	if err != nil {
		a.emitVlinkInstallStatus("无法确定安装路径")
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(binaryPath), 0o755); err != nil {
		a.emitVlinkInstallStatus("创建目录失败")
		return "", fmt.Errorf("failed to create directory: %w", err)
	}

	tmpFile, err := os.CreateTemp(filepath.Dir(binaryPath), "vlink-*")
	if err != nil {
		a.emitVlinkInstallStatus("写入临时文件失败")
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.Write(binaryData); err != nil {
		_ = tmpFile.Close()
		a.emitVlinkInstallStatus("写入临时文件失败")
		return "", fmt.Errorf("failed to write temp file: %w", err)
	}
	if err := tmpFile.Close(); err != nil {
		a.emitVlinkInstallStatus("写入临时文件失败")
		return "", fmt.Errorf("failed to close temp file: %w", err)
	}

	if err := os.Rename(tmpFile.Name(), binaryPath); err != nil {
		a.emitVlinkInstallStatus("安装失败")
		return "", fmt.Errorf("failed to move vlink: %w", err)
	}

	a.emitVlinkInstallStatus("安装完成")
	return "vlink installed", nil
}

func downloadVlinkBinary(version string) ([]byte, error) {
	baseURL := "https://qtopie.space/downloads/vlink/"
	finalVersion := strings.TrimSpace(version)
	if finalVersion == "" || finalVersion == "latest" {
		latest, err := fetchLatestVersionFromChecksums(baseURL, "vlink")
		if err != nil {
			return nil, err
		}
		finalVersion = latest
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

func fetchLatestVersionFromChecksums(baseURL string, prefix string) (string, error) {
	url := strings.TrimRight(baseURL, "/") + "/checksums.txt"
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "", fmt.Errorf("failed to download checksums: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("checksums download failed: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read checksums: %w", err)
	}

	versions := extractVersionsFromChecksums(string(body), prefix)
	if len(versions) == 0 {
		return "", fmt.Errorf("no versions found for %s in checksums", prefix)
	}

	latest := versions[0]
	for _, v := range versions[1:] {
		if compareSemver(v, latest) > 0 {
			latest = v
		}
	}
	return latest, nil
}

func extractVersionsFromChecksums(content string, prefix string) []string {
	lines := strings.Split(content, "\n")
	var versions []string
	marker := prefix + "_v"
	for _, line := range lines {
		idx := strings.Index(line, marker)
		if idx == -1 {
			continue
		}
		chunk := line[idx+len(prefix)+1:]
		ver := readSemverWithV(chunk)
		if ver != "" {
			versions = append(versions, ver)
		}
	}
	return versions
}

func readSemverWithV(input string) string {
	if !strings.HasPrefix(input, "v") {
		return ""
	}
	parts := strings.SplitN(input, "_", 2)
	ver := parts[0]
	if isValidSemver(ver) {
		return ver
	}
	return ""
}

func isValidSemver(ver string) bool {
	if !strings.HasPrefix(ver, "v") {
		return false
	}
	segments := strings.Split(ver[1:], ".")
	if len(segments) < 2 || len(segments) > 3 {
		return false
	}
	for _, seg := range segments {
		if seg == "" {
			return false
		}
		for _, ch := range seg {
			if ch < '0' || ch > '9' {
				return false
			}
		}
	}
	return true
}

func compareSemver(a string, b string) int {
	parse := func(v string) []int {
		parts := strings.Split(strings.TrimPrefix(v, "v"), ".")
		out := []int{0, 0, 0}
		for i := 0; i < len(parts) && i < 3; i++ {
			var n int
			_, _ = fmt.Sscanf(parts[i], "%d", &n)
			out[i] = n
		}
		return out
	}
	va := parse(a)
	vb := parse(b)
	for i := 0; i < 3; i++ {
		if va[i] > vb[i] {
			return 1
		}
		if va[i] < vb[i] {
			return -1
		}
	}
	return 0
}

func (a *App) emitVlinkInstallStatus(message string) {
	if a.ctx == nil {
		return
	}
	wailsruntime.EventsEmit(a.ctx, "vlink:install", message)
}

func (a *App) emitVlinkConfigRequired(path string) {
	if a.ctx == nil {
		return
	}
	content := defaultVlinkConfigContent()
	if data, err := os.ReadFile(path); err == nil {
		content = string(data)
	}
	wailsruntime.EventsEmit(a.ctx, "vlink:config", VlinkConfig{Path: path, Content: content})
}
