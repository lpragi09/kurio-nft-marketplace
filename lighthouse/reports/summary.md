# Lighthouse — medianas (3 execuções por página/perfil)

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inicio | mobile | 69 | 100 | 100 | 100 | 5394 ms | 0.001 | 307 ms |
| inicio | desktop | 99 | 100 | 100 | 100 | 980 ms | 0.002 | 15 ms |
| detalhe | mobile | 78 | 100 | 100 | 100 | 4785 ms | 0.029 | 257 ms |
| detalhe | desktop | 98 | 100 | 100 | 100 | 1109 ms | 0.006 | 0 ms |

## Ambiente

- **date**: 2026-11-24T19:01:03.501Z
- **lighthouse**: 13.6.0
- **chrome**: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.0.0 Safari/537.36
- **node**: v24.14.0
- **os**: Windows_NT 10.0.26200 (x64)
- **cpu**: AMD Ryzen 5 5600X 6-Core Processor             
- **target**: http://localhost:4174
- **runsPerPageProfile**: 3
- **throttling**: Lighthouse defaults (mobile: simulated slow 4G + 4x CPU; desktop: desktop-config)
- **scenario**: padrao (mocks MSW ativos, latência 120 ms)
