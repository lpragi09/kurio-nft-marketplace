# Lighthouse — medianas (3 execuções por página/perfil)

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inicio | mobile | 80 | 100 | 100 | 100 | 3948 ms | 0.001 | 336 ms |
| inicio | desktop | 99 | 100 | 100 | 100 | 865 ms | 0.002 | 6 ms |
| detalhe | mobile | 85 | 100 | 100 | 100 | 3669 ms | 0.029 | 258 ms |
| detalhe | desktop | 99 | 100 | 100 | 100 | 829 ms | 0.006 | 0 ms |

## Ambiente

- **date**: 2026-11-25T02:54:34.878Z
- **lighthouse**: 13.6.0
- **chrome**: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/158.0.0.0 Safari/537.36
- **node**: v24.14.0
- **os**: Windows_NT 10.0.26200 (x64)
- **cpu**: AMD Ryzen 5 5600X 6-Core Processor             
- **target**: http://localhost:4174
- **runsPerPageProfile**: 3
- **throttling**: Lighthouse defaults (mobile: simulated slow 4G + 4x CPU; desktop: desktop-config)
- **scenario**: padrao (mocks MSW ativos, latência 120 ms)
