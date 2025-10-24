.PHONY: build

OUTPUTS=$(shell find dist/*)

build: $(OUTPUTS)

$(OUTPUTS): $(shell find src/* -name '*.ts' -type f)
	npx tsc -p tsconfig.json
