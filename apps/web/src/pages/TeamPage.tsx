import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../api.ts";
import { ROLE_LABELS, useAuth } from "../auth.tsx";
import { PageHead, Shell } from "../components/Shell.tsx";
import { formatDate, initials } from "../format.ts";
import type { Member, Role } from "../types.ts";
import { useLoad } from "../useLoad.ts";

const roles = Object.keys(ROLE_LABELS) as Role[];

export function TeamPage() {
  const { session } = useAuth();
  const { data: members, error, reload } = useLoad(api.listMembers);
  const [isAdding, setIsAdding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<{ name: string; password: string } | null>(null);

  async function run(action: () => Promise<unknown>) {
    setProblem(null);
    try {
      await action();
    } catch (failure) {
      setProblem((failure as Error).message);
    }
    await reload();
  }

  async function resetPassword(member: Member) {
    await run(async () => {
      const { temporaryPassword } = await api.resetMemberPassword(member.id);
      setNewPassword({ name: member.name, password: temporaryPassword });
    });
  }

  return (
    <Shell>
      <div className="page">
        <PageHead title="Team" subtitle="Who can use this workspace, and what each person can do.">
          <button className="btn btn-p" onClick={() => setIsAdding(true)}><Plus size={15} aria-hidden="true" /> Add member</button>
        </PageHead>

        {(error || problem) && <div className="notice err" role="alert">{error ?? problem}</div>}

        <div className="card">
          <div className="tbl-wrap tbl-round">
            <table className="tbl">
              <thead><tr><th>Member</th><th>Role</th><th className="hide-m">Last signed in</th><th>Access</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {members?.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="row">
                        <span className="avatar">{initials(member.name)}</span>
                        <div>
                          <div className="strong">{member.name}{member.id === session?.user.id ? " (you)" : ""}</div>
                          <div className="small muted">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select className="select team-role" aria-label={`Role for ${member.name}`} value={member.role} onChange={(event) => run(() => api.updateMember(member.id, { role: event.target.value as Role }))}>
                        {roles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                      </select>
                    </td>
                    <td className="muted hide-m">{formatDate(member.lastSignInAt)}</td>
                    <td><span className={`badge ${member.isActive ? "b-ok" : "b-off"}`}>{member.isActive ? "Active" : "Deactivated"}</span></td>
                    <td className="r">
                      <div className="row team-actions">
                        <button className="btn btn-sm" onClick={() => resetPassword(member)}>Reset password</button>
                        <button className="btn btn-sm btn-g" onClick={() => run(() => api.updateMember(member.id, { isActive: !member.isActive }))}>{member.isActive ? "Deactivate" : "Reactivate"}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isAdding && (
        <AddMemberDialog
          onClose={() => setIsAdding(false)}
          onAdded={async (name, password) => {
            setIsAdding(false);
            setNewPassword({ name, password });
            await reload();
          }}
        />
      )}

      {newPassword && (
        <div className="scrim">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Temporary password">
            <h2>Temporary password for {newPassword.name}</h2>
            <p className="muted">Pass this on securely. It is only shown once, and they will be asked to replace it.</p>
            <code className="var temp-password">{newPassword.password}</code>
            <div className="modal-a"><button className="btn btn-p" onClick={() => setNewPassword(null)}>Done</button></div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function AddMemberDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (name: string, password: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("business_user");
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api.addMember({ name, email, role });
      await onAdded(result.member.name, result.temporaryPassword);
    } catch (failure) {
      setProblem((failure as Error).message);
    }
  }

  return (
    <div className="scrim">
      <form className="modal" role="dialog" aria-modal="true" aria-label="Add member" onSubmit={submit}>
        <h2>Add member</h2>
        <div className="field">
          <label className="label" htmlFor="member-name">Full name</label>
          <input id="member-name" className="input" required autoFocus maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="member-email">Work email</label>
          <input id="member-email" className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="member-role">Role</label>
          <select id="member-role" className="select" value={role} onChange={(event) => setRole(event.target.value as Role)}>
            {roles.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}
          </select>
        </div>
        {problem && <p className="err-msg">{problem}</p>}
        <div className="modal-a">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-p">Add member</button>
        </div>
      </form>
    </div>
  );
}
