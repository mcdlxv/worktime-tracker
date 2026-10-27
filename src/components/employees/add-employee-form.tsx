import { type FormEvent, useState } from "react";
import { Button, TextInput } from "@/components/ui";
import { apiClient, describeError } from "@/lib/api-client";

export function AddEmployeeForm({ onAdded }: { onAdded: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // The server checks the name and words the message, so there is one set of rules.
      await apiClient.addEmployee(name);
      setName("");
      await onAdded();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} noValidate className="space-y-2">
      <label htmlFor="new-employee" className="block text-sm font-medium">
        Новый сотрудник
      </label>
      <div className="flex gap-2">
        <TextInput
          id="new-employee"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          placeholder="Имя и фамилия"
          maxLength={100}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "new-employee-error" : undefined}
        />
        <Button type="submit" disabled={busy}>
          Добавить
        </Button>
      </div>
      {error && (
        <p id="new-employee-error" role="alert" className="text-sm text-alert">
          {error}
        </p>
      )}
    </form>
  );
}
