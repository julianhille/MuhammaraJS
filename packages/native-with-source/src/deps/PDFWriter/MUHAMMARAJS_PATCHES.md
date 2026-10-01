# MuhammaraJS Changes To PDFWriter

This directory is vendored from [PDF-Writer](https://github.com/galkahana/PDF-Writer)
and carries MuhammaraJS changes. The thread-safety patches that `recryptAsync()`
relies on are marked with `MuhammaraJS:` comments:

```sh
grep -rn "MuhammaraJS:" .
```

- `Trace.cpp`: one default trace per thread (`static thread_local`).
- `SafeBufferMacrosDefs.h`: `SAFE_LOCAL_TIME` uses `localtime_r()` on POSIX.
- `PDFDate.cpp`: `SetToCurrentTime()` uses `gmtime_r()` / `gmtime_s()`.

Reapply them when updating PDFWriter. The reasons and the audit of the
remaining global state are in
[Security And Vendored Dependencies](../../../../native/docs/security.md#thread-safety-patches-in-pdfwriter).
