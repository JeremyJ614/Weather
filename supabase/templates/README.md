# Auth email templates

Paste each into Supabase → Authentication → Emails → Templates:

| Template            | File                  | Subject                     |
| ------------------- | --------------------- | --------------------------- |
| Confirm sign up     | `confirm-signup.html` | Confirm your email          |
| Magic link          | `magic-link.html`     | Your StormSync sign-in link |
| Change email        | `change-email.html`   | Confirm your new email      |
| Reset password      | `reset-password.html` | Reset your password         |

Links go to `/auth/confirm` on our own domain (a link to a different domain
than the sender is a spam signal). Under SMTP settings, set the sender name to
`StormSync Weather` and the address to `account@send.sswx.space`.
