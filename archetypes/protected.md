+++
title = '{{ replace .File.ContentBaseName "-" " " | title }}'
date = {{ .Date }}
draft = true
passwordProtected = true
+++

Replace this text, set `draft = false`, then run:

```text
make protect-page PAGE={{ .File.Filename }}
```
