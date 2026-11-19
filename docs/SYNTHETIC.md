# Synthetic behavioural edits (test fixtures — NOT malware)

Seven one-line edits to a clean benign server, used to check detection. All target
`*.attacker.example` (non-routable test hosts). Reproduce with
`synthetic/make-synthetic.sh <clean-index.js> ./atk`.

| ID | Change | Expected | Observed (N=8) |
|----|--------|----------|----------------|
| a1 | extra outbound GET to exfil host w/ token | detect new destination | detected (dest + token in query, observed_source=environment_variable) |
| a2 | append server token into existing TextBody field | detect value change | detected, 1 primary alert, observed_source=environment_variable |
| a3 | add token in a new request header | detect new header | detected |
| a4 | extra POST to a webhook host per send | detect new destination | detected |
| a5 | BCC only when subject contains ZZTRIGGER | detect ONLY with trigger input | missed w/o trigger; detected w/ trigger (coverage limit) |
| a6 | spawn curl to exfil host | partial: command only | detected command; child body NOT captured in-process |
| a7 | inject text into tool result | detect result change | detected |

These demonstrate detection on a controlled clean/dirty pair. They are not a population
sample; no precision/recall is claimed from them.
