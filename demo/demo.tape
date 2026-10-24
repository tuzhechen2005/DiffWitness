Output demo/demo.gif

Set Shell "bash"
Set Width 1200
Set Height 1000
Set FontSize 18
Set Padding 16
Set TypingSpeed 5ms

# Run from the repository root after npm ci. All hypotheses are recorded Gemma replies.
# Commands measured at about 4.4 s, 0.8 s, and 4.6 s locally; sleeps include execution.
# 31 s of sleeps plus less than 3 s of typing keeps the recording under 40 s.
Hide
Type "clear"
Enter
Show

Type "npx diffwitness examples/order-id/old.ts examples/order-id/new.ts --replay --label bug --out /tmp/order-id.test.ts"
Enter
Sleep 11s

Ctrl+L
Type "npx vitest run /tmp/order-id.test.ts --root /tmp"
Enter
Sleep 8s

Ctrl+L
Type "npx diffwitness examples/rounding/old.ts examples/rounding/new.ts --replay --label intended --out /tmp/rounding.test.ts"
Enter
Sleep 12s
