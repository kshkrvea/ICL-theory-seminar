MAIN = main
NOTES = main-notes
# Review build: reveal hidden (handout-only) slides + show speaker notes.
NOTESOPTS = \PassOptionsToClass{handout}{beamer}\def\shownotes{}\input{$(MAIN).tex}

.PHONY: all notes preview clean

all:
	pdflatex $(MAIN).tex
	-bibtex $(MAIN)
	pdflatex $(MAIN).tex
	pdflatex $(MAIN).tex

# Fast single-section build -> preview.pdf. Rebuilds only ONE section so you
# can iterate on the file you just changed. Pick the section with SEC=<name>
# (a file in sections/, without the .tex), default tabicl. E.g.:
#   make preview SEC=tabicl
SEC = tabicl
preview:
	pdflatex -jobname=preview "\def\previewsection{sections/$(SEC)}\input{preview.tex}"

# main-notes.pdf: hidden slides made visible + speaker notes shown.
notes:
	pdflatex -jobname=$(NOTES) "$(NOTESOPTS)"
	-bibtex $(NOTES)
	pdflatex -jobname=$(NOTES) "$(NOTESOPTS)"
	pdflatex -jobname=$(NOTES) "$(NOTESOPTS)"

clean:
	rm -f *.aux *.log *.bbl *.blg *.nav *.out *.snm *.toc *.vrb
