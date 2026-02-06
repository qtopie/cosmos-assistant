package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"time"

	"golang.org/x/net/proxy"
	"google.golang.org/genai"
)

func main() {
	// SOCKS5 proxy address
	proxyURL, err := url.Parse("socks5://192.168.50.1:1080")
	if err != nil {
		panic(err)
	}

	// Create a SOCKS5 dialer
	dialer, err := proxy.FromURL(proxyURL, proxy.Direct)
	if err != nil {
		panic(err)
	}

	// Create an HTTP client with the SOCKS5 dialer
	httpTransport := &http.Transport{
		Dial: dialer.Dial,
	}

	httpClient := &http.Client{Transport: httpTransport}

	apiKey := "AIzaSyDdJ9MLj-2QvE57ewZLyewGcDGfV7X6HQc"
	ctx, _ := context.WithTimeout(context.Background(), 5*time.Second)
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:     apiKey,
		Backend:    genai.BackendGeminiAPI,
		HTTPClient: httpClient,
	})
	if err != nil {
		log.Fatal(err)
	}

	result, err := client.Models.GenerateContent(
		ctx,
		"gemini-2.0-flash",
		genai.Text("Explain how AI works in a few words"),
		nil,
	)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Text())
}
