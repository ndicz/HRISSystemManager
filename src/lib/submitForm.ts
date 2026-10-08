import type { FormEvent } from "react";

// <form action={fn}> makes React reset every uncontrolled field once fn
// resolves — and a handler that catches a server-side validation error
// resolves normally, so the person's whole input was wiped right as the
// error message appeared. Submitting through onSubmit keeps what they typed;
// dialogs that should clear on success already call form.reset() or unmount.
//   <form onSubmit={(e) => submitForm(e, handleSubmit)}>
export function submitForm(e: FormEvent<HTMLFormElement>, handler: (formData: FormData) => unknown) {
  e.preventDefault();
  const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
  void handler(new FormData(e.currentTarget, submitter));
}
