# Assets

## `Fraunces-SemiBold.ttf`

A static instance of [Fraunces](https://fonts.google.com/specimen/Fraunces)
(opsz 9–144, weight 600), used **only** by the Open Graph image generator in
`src/app/opengraph-image.tsx`.

The rest of the site gets Fraunces through `next/font`, which is the better
route — it subsets, self-hosts and handles the variable axes. But `ImageResponse`
runs in the Edge runtime with Satori, which cannot use a `next/font` handle and
needs the raw font bytes.

Committing the file rather than fetching it at render time is deliberate:

- no network call on the path that generates a social preview,
- the image renders identically offline and in CI,
- nothing breaks if Google reorganises their CDN URLs, which they do.

Licensed under the [SIL Open Font License 1.1](https://openfontlicense.org),
which permits redistribution as part of a larger work. Copyright 2020 The
Fraunces Project Authors (https://github.com/undercasetype/Fraunces).
