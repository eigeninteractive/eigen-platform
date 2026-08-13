---
"@eigeninteractive/kernel": patch
"@eigeninteractive/server": patch
---

Charge budget clocks according to the persisted turn that ended, including
budget-to-override, override timeout, and finishing transitions, and arm
deadline alarms at the first genuinely expired millisecond.
