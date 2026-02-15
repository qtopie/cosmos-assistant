VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null)
LDFLAGS := -X 'main.appVersion=$(VERSION)'

all: build

dev:
	wails dev -tags webkit2_41 -ldflags "$(LDFLAGS)"

build:
	wails build -clean -s -tags webkit2_41 -ldflags "$(LDFLAGS)"

clean:
	go clean
	rm -rf build/bin/
