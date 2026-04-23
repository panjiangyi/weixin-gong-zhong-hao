#!/bin/bash
curl -X POST http://localhost:${PORT:-3009}/mpapi/full-publish \
  -F 'title=test article' \
  -F 'markdown=@test-article.md' \
  -F 'cover=@./test-cover.jpg' \
  -F 'author=auto' \
  -F 'publish_method=free'
