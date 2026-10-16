<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use the shared LanguageProvider and useLanguage translation dictionary for user-facing interface copy; keep user-created goals, task titles, and files unchanged so language switching never changes personal data.
- Persist interface language on the device and share it across routes; settings uses the same live selection to avoid a second conflicting language state.
