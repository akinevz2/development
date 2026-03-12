submission: 181472-limits_of_computation-2026.pdf

.PHONY: submission clean open code edit

clean:
	rm -f 181472-limits_of_computation-2026.pdf

open: submission
	code 181472-limits_of_computation-2026.pdf

181472-limits_of_computation-2026.pdf: src/assignment.md
	pandoc src/assignment.md -o 181472-limits_of_computation-2026.pdf

all: submission

code:
	code Makefile

edit:
	code src/TOC.md