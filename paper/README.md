# ZoraOS Paper

This directory is an Overleaf-ready LaTeX manuscript package.

## Overleaf

Create a blank project, upload this directory's contents, and set `main.tex` as the main document. Use the default `pdfLaTeX` compiler.

## Local Compilation

From this directory run:

```bash
pdflatex -interaction=nonstopmode -halt-on-error main.tex
bibtex main
pdflatex -interaction=nonstopmode -halt-on-error main.tex
pdflatex -interaction=nonstopmode -halt-on-error main.tex
```

The manuscript intentionally distinguishes implemented, observed, proposed, and interpretive claims. Do not add private screenshots, raw logs, API credentials, account identifiers, or third-party data to this directory.
