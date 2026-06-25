MAIN = main

.PHONY: all clean

all:
	pdflatex $(MAIN).tex
	bibtex $(MAIN)
	pdflatex $(MAIN).tex
	pdflatex $(MAIN).tex

clean:
	rm -f *.aux *.log *.bbl *.blg *.nav *.out *.snm *.toc *.vrb
