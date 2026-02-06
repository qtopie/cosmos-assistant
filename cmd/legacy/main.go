package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"

	"golang.org/x/net/proxy"
	"google.golang.org/genai"
)

func main() {
	ctx := context.Background()

	// SOCKS proxy address
	proxyURL, err := url.Parse("socks5://127.0.0.1:1080")
	if err != nil {
		panic(err)
	}

	// Create a SOCKS5 dialer
	dialer, err := proxy.FromURL(proxyURL, proxy.Direct)
	if err != nil {
		panic(err)
	}

	// Create HTTP client with the SOCKS5 dialer
	httpTransport := &http.Transport{
		Dial: dialer.Dial,
	}
	httpClient := &http.Client{Transport: httpTransport}

	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:     "AIzaSyDdJ9MLj-2QvE57ewZLyewGcDGfV7X6HQc",
		Backend:    genai.BackendGeminiAPI,
		HTTPClient: httpClient,
	})
	if err != nil {
		log.Fatal(err)
	}

	result, err := client.Models.GenerateContent(
		ctx,
		"gemini-2.0-flash",
		genai.Text("今天天气怎么样？"),
		&genai.GenerateContentConfig{
			// Tools: ,
		},
	)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Text())
}
