# money-pit feature map

One file per user-facing feature. Each says how a user reaches it, how to drive it with
`scripts/drive.mjs`, and what observable end state proves it. When a feature has several entry
points, a proof covers all of them.

| Feature                      | File                               | Entry points                                                                                                        |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Upload statements            | [upload.md](upload.md)             | Empty-state drop zone / file input, account menu "Add statement" (once data is loaded)                              |
| Explore the table and charts | [explore.md](explore.md)           | Column menus, per-chart mode toggles, charts pane hide/resize, Reset, reload persistence                            |
| Recategorize transactions    | [recategorize.md](recategorize.md) | Category pill on a row, row context menu, selection bar                                                             |
| Category rules               | [rules.md](rules.md)               | Account menu "Category rules…", `/rules`, row context menu, multi-select "Create rule", `/rules/new`, `/rules/[id]` |
| Rule suggestions             | [suggestions.md](suggestions.md)   | Dashboard banner "N rule suggestions for Other", its Create rule and Dismiss buttons                                |
| Categories                   | [categories.md](categories.md)     | Account menu "Categories…", the link on `/rules`, `/categories`                                                     |
| Account menu, reset and auth | [account-auth.md](account-auth.md) | Account menu ("Start over" dialog, "Sign in…"), `/sign-in`, `/api/auth/*`                                           |

Update this map in the same change that adds, removes or renames a user-facing feature.
`/maintain-verification-skill` audits it against the code.
