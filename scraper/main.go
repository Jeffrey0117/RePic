package main

import (
	"crypto/tls"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

type Result struct {
	Success bool     `json:"success"`
	Images  []string `json:"images,omitempty"`
	Error   string   `json:"error,omitempty"`
}

func main() {
	urlFlag := flag.String("url", "", "URL to scrape")
	flag.Parse()

	if *urlFlag == "" {
		outputError("URL is required")
		return
	}

	images, err := scrapeImages(*urlFlag)
	if err != nil {
		outputError(err.Error())
		return
	}

	outputSuccess(images)
}

func outputSuccess(images []string) {
	result := Result{Success: true, Images: images}
	json.NewEncoder(os.Stdout).Encode(result)
}

func outputError(msg string) {
	result := Result{Success: false, Error: msg}
	json.NewEncoder(os.Stdout).Encode(result)
}

func scrapeImages(targetURL string) ([]string, error) {
	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		return nil, err
	}

	// Custom TLS config for compatibility
	tlsConfig := &tls.Config{
		MinVersion: tls.VersionTLS12,
		MaxVersion: tls.VersionTLS13,
	}

	// Custom transport with TLS config
	transport := &http.Transport{
		TLSClientConfig:     tlsConfig,
		MaxIdleConns:        10,
		IdleConnTimeout:     30 * time.Second,
		DisableCompression:  false,
		TLSHandshakeTimeout: 10 * time.Second,
	}

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout:   15 * time.Second,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("too many redirects")
			}
			// Copy cookies on redirect
			if len(via) > 0 {
				for _, cookie := range via[0].Cookies() {
					req.AddCookie(cookie)
				}
			}
			return nil
		},
	}

	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		return nil, err
	}

	// Set headers
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7")

	// PTT needs over18 cookie
	if strings.Contains(parsedURL.Host, "ptt.cc") {
		req.Header.Set("Cookie", "over18=1")
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	html := string(body)
	images := extractImages(html, parsedURL)

	return images, nil
}

func extractImages(html string, baseURL *url.URL) []string {
	imageSet := make(map[string]bool)
	var mu sync.Mutex

	// Patterns to extract
	patterns := []string{
		// img src
		`<img[^>]+src=["']([^"']+)["']`,
		// srcset
		`srcset=["']([^"']+)["']`,
		// og:image
		`<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']`,
		`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']`,
		// background-image
		`background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)`,
		// Direct image links (common on forums like PTT)
		`href=["'](https?://[^"']+\.(?:jpg|jpeg|png|gif|webp))["']`,
		// imgur links
		`(https?://(?:i\.)?imgur\.com/[a-zA-Z0-9]+\.(?:jpg|jpeg|png|gif|webp))`,
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindAllStringSubmatch(html, -1)
		for _, match := range matches {
			if len(match) > 1 {
				// For srcset, split by comma and get URLs
				if strings.Contains(pattern, "srcset") {
					srcsetParts := strings.Split(match[1], ",")
					for _, part := range srcsetParts {
						part = strings.TrimSpace(part)
						fields := strings.Fields(part)
						if len(fields) > 0 {
							addImage(imageSet, &mu, fields[0], baseURL)
						}
					}
				} else {
					addImage(imageSet, &mu, match[1], baseURL)
				}
			}
		}
	}

	// Convert set to slice
	var images []string
	for img := range imageSet {
		images = append(images, img)
	}

	return images
}

func addImage(imageSet map[string]bool, mu *sync.Mutex, imgURL string, baseURL *url.URL) {
	// Normalize URL
	imgURL = strings.TrimSpace(imgURL)

	if imgURL == "" {
		return
	}

	// Skip data URLs and tiny tracking images
	if strings.HasPrefix(imgURL, "data:") ||
		strings.Contains(imgURL, "1x1") ||
		strings.Contains(imgURL, "pixel") ||
		strings.Contains(imgURL, "tracking") ||
		strings.Contains(imgURL, "spacer") {
		return
	}

	// Handle protocol-relative URLs
	if strings.HasPrefix(imgURL, "//") {
		imgURL = "https:" + imgURL
	}

	// Handle relative URLs
	if strings.HasPrefix(imgURL, "/") {
		imgURL = baseURL.Scheme + "://" + baseURL.Host + imgURL
	}

	// Skip non-http URLs
	if !strings.HasPrefix(imgURL, "http") {
		return
	}

	mu.Lock()
	imageSet[imgURL] = true
	mu.Unlock()
}
