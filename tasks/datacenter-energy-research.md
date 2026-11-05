# Data-center energy and market refresh — 2026-11-04

Research cutoff: November 4, 2026. All figures below are from owning institutions. Forecasts predate the November 3 election; none is an election-adjusted forecast. No compatible 2025 U.S. historical estimate was verified from the new LBNL abstract, so do not invent a baseline or interpolate annual forecasts.

## Recommended national chart

Use separate horizontal ranges in **annual U.S. electricity consumption (TWh/year)**. Their scenarios are not confidence intervals, and their scopes differ.

| Study / publication | Year shown | Low | Central | High | Definition |
|---|---:|---:|---:|---:|---|
| LBNL, *2025 Update*, June 2026 | 2030 | 521 | 649 | 843 | Whole data-center electricity; compounded uncertainty bounds around a reference case |
| EPRI, *Powering Intelligence 2026*, February 2026 | 2030 | 383 | 596 | 793 | Small and large data centers **plus cryptocurrency mining**; project realization scenarios |

[LBNL publication and abstract](https://eta-publications.lbl.gov/publications/united-states-data-center-energy-2025) gives 11.8% of U.S. electricity in its reference case and 9.5–15.3% across compounded uncertainty scenarios. Its model starts from equipment shipments, equipment power and cooling. Individual sensitivity runs are 578, 664, 590 and 782 TWh; they are not the overall bounds. The abstract is directly readable; the linked eScholarship page did not expose the full report in this session.

[EPRI annual and peak use](https://powering-intelligence.epri.com/annual-peak-use.html) gives exact annual values 383 / 596 / 793 TWh, and an estimated 2024 range of 177–192 TWh. The scope includes crypto. Nominal capacity is translated through cooling overhead, utilization and equipment ramp-up; this is why proposed MW is not realized load. Its peak-demand scenarios are 45 / 71 / 94 GW, defined as noncoincident aggregate state peaks. These must not be divided by national nameplate generation to make a grid-adequacy score.

[EPRI executive summary](https://powering-intelligence.epri.com/executive-summary.html) explains project-realization cases: Low = most construction plus 25% advanced plans; Medium = all construction, 75% advanced, 10% early; High = all construction and advanced, 30% early. Electricity shares are roughly 9% / 13% / 17%. Publication month is confirmed in [EPRI's February 2026 FAQ](https://restservice.epri.com/publicattachment/96784).

## Global context, kept separate

[IEA, April 16, 2026](https://www.iea.org/reports/key-questions-on-energy-and-ai) and its [executive summary](https://www.iea.org/reports/key-questions-on-energy-and-ai/executive-summary): **global** data-center electricity grows from 485 TWh in 2025 to approximately 950 TWh in 2030, around 3% of world demand. Its near-term constraints include equipment, grid connections and community acceptance; these are already present in the outlook. Do not put the 950 TWh number into a U.S. range chart. EIA's [May 19, 2026 AEO explanation](https://www.eia.gov/todayinenergy/detail.php?id=67704) is about **server-only** consumption in commercial buildings, so its 2050 projections are unsuitable for direct comparison with whole-facility 2030 estimates.

## Comparable map bubbles: CBRE eight primary markets

Source: [CBRE H1 2026 press release, August 27, 2026](https://www.cbre.com/press-releases/north-american-data-center-demand-continues-to-outpace-supply-despite-record-construction-activity). The table is labeled Q2 2026. These are tracked market capacity inventories, not metered electricity, the complete U.S. fleet or exclusively AI facilities. Size bubbles by area proportional to inventory; retain consistent units and a readable scale.

| Market | Inventory MW | Available MW |
|---|---:|---:|
| Northern Virginia | 4496.5 | 10.8 |
| Atlanta | 1803.2 | 29.5 |
| Dallas–Fort Worth | 1432.8 | 39.6 |
| Phoenix | 1069.2 | 12.1 |
| Chicago | 910.6 | 20.0 |
| Silicon Valley | 509.2 | 21.2 |
| Hillsboro, Oregon | 491.4 | 1.1 |
| New York Tri-State | 190.0 | 13.7 |

[CBRE report overview](https://www.cbre.com/insights/books/north-america-data-center-trends-h1-2026) reports rounded total inventory 10,903 MW, vacancy 1.4%, construction 7,481.1 MW and preleasing 80.4%. Northern Virginia construction is 2,420.2 MW; Atlanta construction is 2,882 MW. The individual inventory rows sum to 10,902.9 MW; use the published rounded aggregate. Local opposition and power delivery both constrain new supply.

### Short market annotations

- **Northern Virginia:** capacity arriving in 2026 was committed; power delivery timing pushes leasing further out. [CBRE market chapter](https://www.cbre.com/insights/books/north-america-data-center-trends-h1-2026/northern-virginia-data-center-market).
- **Atlanta:** construction exceeds Northern Virginia; Georgia developers are exploring rural sites with better transmission access. [CBRE market chapter](https://www.cbre.com/insights/books/north-america-data-center-trends-h1-2026/atlanta-data-center-market).
- **Dallas–Fort Worth:** over 765 MW under construction, 95% preleased; another 3.7 GW planned but not started. Grid timing is increasing interest in on-site power. [CBRE market chapter](https://www.cbre.com/insights/books/north-america-data-center-trends-h1-2026/dallas-ft-worth-data-center-market).
- **Chicago:** 2.2% vacancy; large contiguous availability is constrained until late 2027. [CBRE market chapter](https://www.cbre.com/insights/books/north-america-data-center-trends-h1-2026/chicago-data-center-market).
- **Hillsboro:** 170.3 MW under construction, over 90% preleased; no contiguous block of at least 5 MW available. [CBRE market chapter](https://www.cbre.com/insights/books/north-america-data-center-trends-h1-2026/hillsboro-or-data-center-market).
- **New York Tri-State:** scarce contiguous blocks above 5 MW constrain tenant choices. [CBRE market chapter](https://www.cbre.com/insights/books/north-america-data-center-trends-h1-2026/new-york-tri-state-data-center-market).
- **Phoenix:** over 260 MW absorbed in H1; local restrictions and opposition reduce powered-site options. [CBRE market chapter](https://www.cbre.com/insights/books/north-america-data-center-trends-h1-2026/phoenix-data-center-market).
- **Silicon Valley:** limited land, power and long development schedules constrain delivery. [CBRE market chapter](https://www.cbre.com/insights/books/north-america-data-center-trends-h1-2026/silicon-valley-data-center-market).

CBRE chapters also describe tax incentives and moratoria, but use governing state records before treating those legal claims as enacted policy on the page. Quantitative map observations above do not depend on those claims.

## Grid annotation points, not invented risk boundaries

- **PJM — January 14, 2026 forecast:** 2030 summer peak **183,008 MW** for all loads, not just data centers; 2027 160,451 MW, 2028 165,567, 2029 171,530. Near-term forecasts were reduced versus 2025 after better project vetting plus economic/EV revisions. Distinguish a system load forecast from available capacity. [PJM source](https://insidelines.pjm.com/pjms-updated-20-year-forecast-continues-to-see-significant-long-term-load-growth/).
- **MISO — June 4, 2026 survey:** sufficient regional capacity projected over five years, conditional on the expected buildout; submitted load grows **3.1–5.1% annually**, and seasonal risk shifts toward winter. The data were collected in April. Do not reproduce an old blanket MISO deficit claim. [OMS–MISO original presentation](https://cdn.misoenergy.org/20260604%20OMS-MISO%20Survey%20Results%20Workshop%20Presentation761711.pdf).
- **ERCOT — February 2026 report:** Far West load growth can outrun transmission additions; low-wind nights are a constraint even where renewables are abundant. The report described a move toward batch interconnection studies. Use this dated physical constraint rather than claiming the large request queue is a forecast. [ERCOT original monthly report](https://www.ercot.com/files/docs/2026/03/17/ERCOT-Monthly-February-2026-FINAL.pdf). The current [forecast library](https://www.ercot.com/gridinfo/load/forecast/index.html) still exposes 2025 long-term tables in its readable listing; no newer exact total was verified here.

## Implementation cautions

- Separate TWh/year (energy), MW/GW (power capacity), market inventory and grid peak demand.
- Show publication and observation dates separately from the November 4 refresh date.
- Election results change permitting, politics and timing; they do not by themselves numerically revise published forecasts. Keep any interactive delay exercise explicitly illustrative and separate from sourced cases.
- Use selected geographic evidence markers, not a choropleth implying every community or utility in a state has the same risk. Grid service territories do not follow state borders.
- Per-source paraphrases on the published page should remain short; these consulted primary webpages generally carry 200-word derivation budgets.
