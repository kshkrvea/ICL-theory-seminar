MAIN = main
NOTES = main-notes
PRESENT = main-present
# Review build: reveal hidden (handout-only) slides + show speaker notes.
NOTESOPTS = \PassOptionsToClass{handout}{beamer}\def\shownotes{}\input{$(MAIN).tex}
# Presentation build: notes on a second screen, overlays kept live (no handout).
PRESENTOPTS = \def\notesonsecond{}\input{$(MAIN).tex}

.PHONY: all notes preview preview-notes present clean

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

# Like `preview`, but shows speaker notes. Uses `show notes` WITHOUT `handout`,
# so overlays stay separate: each \note<n>{...} gets its own note page next to
# its slide version. Pick the section with SEC=<name>. E.g.:
#   make preview-notes SEC=statistical_foundations
preview-notes:
	pdflatex -jobname=preview "\def\shownotes{}\def\previewsection{sections/$(SEC)}\input{preview.tex}"

# main-notes.pdf: hidden slides made visible + speaker notes shown.
notes:
	pdflatex -jobname=$(NOTES) "$(NOTESOPTS)"
	-bibtex $(NOTES)
	pdflatex -jobname=$(NOTES) "$(NOTESOPTS)"
	pdflatex -jobname=$(NOTES) "$(NOTESOPTS)"

# main-present.pdf: dual-screen deck for pdfpc. Each page is  slide | note .
# Present with:  pdfpc --notes=right main-present.pdf
present:
	pdflatex -jobname=$(PRESENT) "$(PRESENTOPTS)"
	-bibtex $(PRESENT)
	pdflatex -jobname=$(PRESENT) "$(PRESENTOPTS)"
	pdflatex -jobname=$(PRESENT) "$(PRESENTOPTS)"

clean:
	rm -f *.aux *.log *.bbl *.blg *.nav *.out *.snm *.toc *.vrb
