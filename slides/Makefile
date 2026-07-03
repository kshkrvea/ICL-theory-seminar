MAIN = main
NOTES = main-notes
# Review build: reveal hidden (handout-only) slides + show speaker notes.
NOTESOPTS = \PassOptionsToClass{handout}{beamer}\def\shownotes{}\input{$(MAIN).tex}

.PHONY: all notes clean

all:
	pdflatex $(MAIN).tex
	-bibtex $(MAIN)
	pdflatex $(MAIN).tex
	pdflatex $(MAIN).tex

# main-notes.pdf: hidden slides made visible + speaker notes shown.
notes:
	pdflatex -jobname=$(NOTES) "$(NOTESOPTS)"
	-bibtex $(NOTES)
	pdflatex -jobname=$(NOTES) "$(NOTESOPTS)"
	pdflatex -jobname=$(NOTES) "$(NOTESOPTS)"

clean:
	rm -f *.aux *.log *.bbl *.blg *.nav *.out *.snm *.toc *.vrb
