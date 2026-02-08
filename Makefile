all: build

dev:
	wails dev -tags webkit2_41

build:
	wails build -clean -s -tags webkit2_41

clean:
	go clean
	rm -rf build/bin/
