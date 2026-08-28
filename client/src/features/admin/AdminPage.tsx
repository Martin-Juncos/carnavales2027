import { FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api/adminApi'
import type { AdminComparsa, AdminItem, AdminNight, AdminUser } from '../../api/adminApi'
import { ApiClientError } from '../../api/apiClient'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import type { Role } from '../../types/domain'

interface UserForm { nombre: string; dni: string; email: string; role: Role; activo: boolean }
interface NightForm { nombre: string; fecha: string }
interface ComparsaForm { nombre: string; nocheId: string; orden: string; activo: boolean }
interface ItemForm { nombre: string; parentItemId: string; orden: string; activo: boolean }
interface AssignmentForm { juradoId: string; nocheId: string; motivo: string }
interface ReplaceForm { assignmentId: string; replacementJurorId: string; motivo: string }

type ConfirmAction =
  | { type: 'openNight'; id: number; label: string }
  | { type: 'closeNight'; id: number; label: string }
  | { type: 'replaceAssignment'; form: ReplaceForm }

const initialUser: UserForm = { nombre: '', dni: '', email: '', role: 'jurado', activo: true }
const initialNight: NightForm = { nombre: '', fecha: '' }
const initialComparsa: ComparsaForm = { nombre: '', nocheId: '', orden: '1', activo: true }
const initialItem: ItemForm = { nombre: '', parentItemId: '', orden: '1', activo: true }
const initialAssignment: AssignmentForm = { juradoId: '', nocheId: '1', motivo: '' }
const initialReplace: ReplaceForm = { assignmentId: '', replacementJurorId: '', motivo: '' }

function errorText(caught: unknown, fallback: string): string {
  return caught instanceof ApiClientError ? caught.message : fallback
}

export function AdminPage() {
  const queryClient = useQueryClient()
  const [userForm, setUserForm] = useState<UserForm>(initialUser)
  const [nightForm, setNightForm] = useState<NightForm>(initialNight)
  const [comparsaForm, setComparsaForm] = useState<ComparsaForm>(initialComparsa)
  const [itemForm, setItemForm] = useState<ItemForm>(initialItem)
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>(initialAssignment)
  const [replaceForm, setReplaceForm] = useState<ReplaceForm>(initialReplace)
  const [orderDraft, setOrderDraft] = useState<Record<number, string>>({})
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const users = useQuery({ queryKey: ['admin-users'], queryFn: adminApi.users })
  const nights = useQuery({ queryKey: ['admin-nights'], queryFn: adminApi.nights })
  const comparsas = useQuery({ queryKey: ['admin-comparsas'], queryFn: adminApi.comparsas })
  const items = useQuery({ queryKey: ['admin-items'], queryFn: adminApi.items })
  const assignments = useQuery({ queryKey: ['admin-assignments'], queryFn: adminApi.assignments })

  const refreshAdmin = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-nights'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-comparsas'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-items'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-assignments'] })
  }

  const createUser = useMutation({
    mutationFn: () => adminApi.createUser(userForm),
    onSuccess: () => { setUserForm(initialUser); setMessage('Usuario creado.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo crear el usuario.')),
  })
  const createNight = useMutation({
    mutationFn: () => adminApi.createNight(nightForm),
    onSuccess: () => { setNightForm(initialNight); setMessage('Noche creada.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo crear la noche.')),
  })
  const createComparsa = useMutation({
    mutationFn: () => adminApi.createComparsa({
      nombre: comparsaForm.nombre,
      nocheId: Number(comparsaForm.nocheId),
      orden: Number(comparsaForm.orden),
      activo: comparsaForm.activo,
    }),
    onSuccess: () => { setComparsaForm(initialComparsa); setMessage('Comparsa creada.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo crear la comparsa.')),
  })
  const updateUser = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Omit<AdminUser, 'id' | 'createdAt' | 'updatedAt'>> }) => adminApi.updateUser(id, body),
    onSuccess: () => { setMessage('Usuario actualizado.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo modificar el usuario.')),
  })
  const deleteUser = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => { setMessage('Usuario dado de baja.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo borrar el usuario.')),
  })
  const updateNight = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Pick<AdminNight, 'nombre' | 'fecha'>> }) => adminApi.updateNight(id, body),
    onSuccess: () => { setMessage('Noche actualizada.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo modificar la noche.')),
  })
  const deleteNight = useMutation({
    mutationFn: adminApi.deleteNight,
    onSuccess: () => { setMessage('Noche borrada.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo borrar la noche.')),
  })
  const comparsasByNight = useMemo(() => {
    const grouped = new Map<number, AdminComparsa[]>()
    for (const comparsa of comparsas.data ?? []) {
      const current = grouped.get(comparsa.nocheId) ?? []
      current.push(comparsa)
      grouped.set(comparsa.nocheId, current)
    }
    return Array.from(grouped.entries()).map(([nightId, rows]) => [nightId, rows.sort((a, b) => a.orden - b.orden)] as const)
  }, [comparsas.data])

  const reorderComparsas = useMutation({
    mutationFn: (nightId: number) => {
      const rows = comparsas.data?.filter((comparsa) => comparsa.nocheId === nightId) ?? []
      return adminApi.reorderComparsas(nightId, {
        comparsas: rows.map((comparsa) => ({
          comparsaId: comparsa.id,
          orden: Number(orderDraft[comparsa.id] ?? comparsa.orden),
        })),
      })
    },
    onSuccess: () => { setMessage('Orden de comparsas actualizado.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo modificar el orden.')),
  })
  const updateComparsa = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Pick<AdminComparsa, 'nombre' | 'nocheId' | 'orden' | 'activo'>> }) => adminApi.updateComparsa(id, body),
    onSuccess: () => { setMessage('Comparsa actualizada.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo modificar la comparsa.')),
  })
  const deleteComparsa = useMutation({
    mutationFn: adminApi.deleteComparsa,
    onSuccess: () => { setMessage('Comparsa dada de baja.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo borrar la comparsa.')),
  })
  const createItem = useMutation({
    mutationFn: () => adminApi.createItem({
      nombre: itemForm.nombre,
      ...(itemForm.parentItemId ? { parentItemId: Number(itemForm.parentItemId) } : { parentItemId: null }),
      orden: Number(itemForm.orden),
      activo: itemForm.activo,
    }),
    onSuccess: () => { setItemForm(initialItem); setMessage('Ítem creado.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo crear el ítem.')),
  })
  const updateItem = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Pick<AdminItem, 'nombre' | 'parentItemId' | 'orden' | 'activo'>> }) => adminApi.updateItem(id, body),
    onSuccess: () => { setMessage('Ítem actualizado.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo modificar el ítem.')),
  })
  const deleteItem = useMutation({
    mutationFn: adminApi.deleteItem,
    onSuccess: () => { setMessage('Ítem dado de baja.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo borrar el ítem.')),
  })
  const createAssignment = useMutation({
    mutationFn: () => adminApi.createAssignment({
      juradoId: assignmentForm.juradoId,
      nocheId: Number(assignmentForm.nocheId),
      ...(assignmentForm.motivo.trim() ? { motivo: assignmentForm.motivo.trim() } : {}),
    }),
    onSuccess: () => { setAssignmentForm(initialAssignment); setMessage('Asignación creada.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo crear la asignación.')),
  })
  const openNight = useMutation({
    mutationFn: (id: number) => adminApi.openNight(id),
    onSuccess: () => { setConfirm(null); setMessage('Noche abierta.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo abrir la noche.')),
  })
  const closeNight = useMutation({
    mutationFn: (id: number) => adminApi.closeNight(id),
    onSuccess: () => { setConfirm(null); setMessage('Noche cerrada.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo cerrar la noche.')),
  })
  const replaceAssignment = useMutation({
    mutationFn: (form: ReplaceForm) => adminApi.replaceAssignment(form.assignmentId, { replacementJurorId: form.replacementJurorId, motivo: form.motivo }),
    onSuccess: () => { setConfirm(null); setReplaceForm(initialReplace); setMessage('Jurado reemplazado con trazabilidad.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo reemplazar el jurado.')),
  })

  const onUser = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); createUser.mutate() }
  const onNight = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); createNight.mutate() }
  const onComparsa = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); createComparsa.mutate() }
  const onItem = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); createItem.mutate() }
  const onAssignment = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); createAssignment.mutate() }
  const onReplace = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); setConfirm({ type: 'replaceAssignment', form: replaceForm }) }

  const busy = createUser.isPending || createNight.isPending || createComparsa.isPending || reorderComparsas.isPending || createItem.isPending || createAssignment.isPending || openNight.isPending || closeNight.isPending || replaceAssignment.isPending || updateUser.isPending || deleteUser.isPending || updateNight.isPending || deleteNight.isPending || updateComparsa.isPending || deleteComparsa.isPending || updateItem.isPending || deleteItem.isPending

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-5">
      {message ? <Card className="border-cyan-500/40 bg-cyan-500/10"><p className="text-cyan-100">{message}</p></Card> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-bold">Usuarios</h2>
          <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={onUser}>
            <input id="admin-user-name" name="nombre" aria-label="Nombre" placeholder="Nombre" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={userForm.nombre} onChange={(event) => setUserForm({ ...userForm, nombre: event.target.value })} />
            <input id="admin-user-dni" name="dni" aria-label="DNI" placeholder="DNI" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={userForm.dni} onChange={(event) => setUserForm({ ...userForm, dni: event.target.value })} />
            <input id="admin-user-email" name="email" aria-label="Email" placeholder="Email" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
            <select id="admin-user-role" name="role" aria-label="Rol" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value as Role })}><option value="jurado">Jurado</option><option value="fiscal">Fiscal</option><option value="escribano">Escribano</option><option value="admin">Admin</option></select>
            <Button type="submit" disabled={busy}>Crear usuario</Button>
          </form>
          <div className="mt-4 max-h-80 space-y-2 overflow-auto">
            {(users.data ?? []).map((user) => (
              <div key={user.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm">
                <p className="font-semibold">{user.nombre}</p>
                <p className="text-slate-400">{user.email} · {user.role} · {user.activo ? 'activo' : 'inactivo'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={busy} onClick={() => {
                    const nombre = window.prompt('Nuevo nombre', user.nombre)
                    if (nombre?.trim()) updateUser.mutate({ id: user.id, body: { nombre: nombre.trim() } })
                  }}>Modificar</Button>
                  <Button variant="danger" disabled={busy || !user.activo} onClick={() => deleteUser.mutate(user.id)}>Borrar</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Noches</h2>
          <form className="mt-3 grid gap-3 sm:grid-cols-3" onSubmit={onNight}>
            <input id="admin-night-name" name="nightName" aria-label="Nombre de noche" placeholder="Nombre" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={nightForm.nombre} onChange={(event) => setNightForm({ ...nightForm, nombre: event.target.value })} />
            <input id="admin-night-date" name="nightDate" aria-label="Fecha" type="date" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={nightForm.fecha} onChange={(event) => setNightForm({ ...nightForm, fecha: event.target.value })} />
            <Button type="submit" disabled={busy}>Crear noche</Button>
          </form>
          <div className="mt-4 space-y-2">
            {(nights.data ?? []).map((night) => <div key={night.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm"><div><p className="font-semibold">#{night.id} · {night.nombre}</p><p className="text-slate-400">{night.fecha}</p></div><Badge tone={night.estado === 'open' ? 'success' : 'warning'}>{night.estado}</Badge><div className="flex gap-2"><Button variant="secondary" onClick={() => {
              const nombre = window.prompt('Nuevo nombre de noche', night.nombre)
              if (nombre?.trim()) updateNight.mutate({ id: night.id, body: { nombre: nombre.trim() } })
            }}>Modificar</Button><Button variant="secondary" onClick={() => setConfirm({ type: 'openNight', id: night.id, label: night.nombre })}>Abrir</Button><Button variant="danger" onClick={() => setConfirm({ type: 'closeNight', id: night.id, label: night.nombre })}>Cerrar</Button><Button variant="danger" disabled={busy} onClick={() => deleteNight.mutate(night.id)}>Borrar</Button></div></div>)}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Comparsas</h2>
          <p className="mt-2 text-sm text-slate-400">El administrador crea comparsas por noche y define el orden de pasada.</p>
          <form className="mt-3 grid gap-3 sm:grid-cols-4" onSubmit={onComparsa}>
            <input aria-label="Nombre comparsa" placeholder="Nombre" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={comparsaForm.nombre} onChange={(event) => setComparsaForm({ ...comparsaForm, nombre: event.target.value })} />
            <input aria-label="Noche ID comparsa" placeholder="Noche ID" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={comparsaForm.nocheId} onChange={(event) => setComparsaForm({ ...comparsaForm, nocheId: event.target.value })} />
            <input aria-label="Orden comparsa" placeholder="Orden" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={comparsaForm.orden} onChange={(event) => setComparsaForm({ ...comparsaForm, orden: event.target.value })} />
            <Button type="submit" disabled={busy}>Crear comparsa</Button>
          </form>
          <div className="mt-4 max-h-80 space-y-4 overflow-auto">
            {comparsasByNight.map(([nightId, rows]) => (
              <div key={nightId} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-semibold">Noche {rows[0]?.nocheNombre ?? nightId}</p>
                  <Button variant="secondary" disabled={busy} onClick={() => reorderComparsas.mutate(nightId)}>Guardar orden</Button>
                </div>
                <div className="grid gap-2">
                  {rows.map((comparsa) => (
                    <label key={comparsa.id} className="grid grid-cols-[1fr_5rem_auto] items-center gap-3 text-sm">
                      <span>{comparsa.nombre} {!comparsa.activo ? <em className="text-rose-200">(inactiva)</em> : null}</span>
                      <input
                        aria-label={`Orden ${comparsa.nombre}`}
                        className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3"
                        inputMode="numeric"
                        value={orderDraft[comparsa.id] ?? String(comparsa.orden)}
                        onChange={(event) => setOrderDraft({ ...orderDraft, [comparsa.id]: event.target.value })}
                      />
                      <span className="flex gap-2">
                        <Button variant="secondary" disabled={busy} onClick={() => {
                          const nombre = window.prompt('Nuevo nombre de comparsa', comparsa.nombre)
                          if (nombre?.trim()) updateComparsa.mutate({ id: comparsa.id, body: { nombre: nombre.trim() } })
                        }}>Modificar</Button>
                        <Button variant="danger" disabled={busy || !comparsa.activo} onClick={() => deleteComparsa.mutate(comparsa.id)}>Borrar</Button>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Rubros / Ítems</h2>
          <form className="mt-3 grid gap-3 sm:grid-cols-4" onSubmit={onItem}>
            <input id="admin-item-name" name="itemName" aria-label="Nombre ítem" placeholder="Nombre" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={itemForm.nombre} onChange={(event) => setItemForm({ ...itemForm, nombre: event.target.value })} />
            <input id="admin-item-parent" name="parentItemId" aria-label="Ítem padre" placeholder="Padre opcional" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={itemForm.parentItemId} onChange={(event) => setItemForm({ ...itemForm, parentItemId: event.target.value })} />
            <input id="admin-item-order" name="itemOrder" aria-label="Orden ítem" placeholder="Orden" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={itemForm.orden} onChange={(event) => setItemForm({ ...itemForm, orden: event.target.value })} />
            <Button type="submit" disabled={busy}>Crear ítem</Button>
          </form>
          <div className="mt-4 max-h-80 space-y-2 overflow-auto">{(items.data ?? []).map((item) => <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm"><p>#{item.id} · {item.nombre} · padre {item.parentItemId ?? '-'} · orden {item.orden} · {item.activo ? 'activo' : 'inactivo'}</p><div className="mt-2 flex gap-2"><Button variant="secondary" disabled={busy} onClick={() => {
            const nombre = window.prompt('Nuevo nombre de ítem', item.nombre)
            if (nombre?.trim()) updateItem.mutate({ id: item.id, body: { nombre: nombre.trim() } })
          }}>Modificar</Button><Button variant="danger" disabled={busy || !item.activo} onClick={() => deleteItem.mutate(item.id)}>Borrar</Button></div></div>)}</div>
        </Card>

        <Card className="xl:col-span-2">
          <h2 className="text-xl font-bold">Asignaciones y reemplazos</h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <form className="grid gap-3" onSubmit={onAssignment}>
              <input id="admin-assignment-juror" name="juradoId" aria-label="Jurado ID" placeholder="Jurado ID" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={assignmentForm.juradoId} onChange={(event) => setAssignmentForm({ ...assignmentForm, juradoId: event.target.value })} />
              <input id="admin-assignment-night" name="assignmentNightId" aria-label="Noche ID asignación" placeholder="Noche ID" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={assignmentForm.nocheId} onChange={(event) => setAssignmentForm({ ...assignmentForm, nocheId: event.target.value })} />
              <input id="admin-assignment-reason" name="assignmentReason" aria-label="Motivo asignación" placeholder="Motivo opcional" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={assignmentForm.motivo} onChange={(event) => setAssignmentForm({ ...assignmentForm, motivo: event.target.value })} />
              <Button type="submit" disabled={busy}>Asignar jurado</Button>
            </form>
            <form className="grid gap-3" onSubmit={onReplace}>
              <input id="admin-replacement-assignment" name="assignmentId" aria-label="Asignación ID" placeholder="Asignación ID activa" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={replaceForm.assignmentId} onChange={(event) => setReplaceForm({ ...replaceForm, assignmentId: event.target.value })} />
              <input id="admin-replacement-juror" name="replacementJurorId" aria-label="Jurado reemplazante ID" placeholder="Jurado reemplazante ID" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={replaceForm.replacementJurorId} onChange={(event) => setReplaceForm({ ...replaceForm, replacementJurorId: event.target.value })} />
              <input id="admin-replacement-reason" name="replacementReason" aria-label="Motivo reemplazo" placeholder="Motivo obligatorio" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={replaceForm.motivo} onChange={(event) => setReplaceForm({ ...replaceForm, motivo: event.target.value })} />
              <Button type="submit" variant="danger" disabled={busy || replaceForm.motivo.trim().length < 3}>Reemplazar jurado</Button>
            </form>
          </div>
          <div className="mt-4 max-h-96 space-y-2 overflow-auto">{(assignments.data ?? []).map((assignment) => <div key={assignment.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm"><p className="font-semibold">{assignment.juradoNombre} · {assignment.nocheNombre}</p><p className="text-slate-400">{assignment.estado} · {assignment.id}</p></div>)}</div>
        </Card>
      </div>

      <Modal
        open={Boolean(confirm)}
        title={confirm?.type === 'replaceAssignment' ? 'Reemplazar jurado' : confirm?.type === 'closeNight' ? 'Cerrar noche' : 'Abrir noche'}
        description="Acción operativa sensible: quedará auditada en backend. Verificá que corresponde antes de confirmar."
        confirmLabel="Confirmar"
        danger={confirm?.type !== 'openNight'}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return
          if (confirm.type === 'openNight') openNight.mutate(confirm.id)
          if (confirm.type === 'closeNight') closeNight.mutate(confirm.id)
          if (confirm.type === 'replaceAssignment') replaceAssignment.mutate(confirm.form)
        }}
      >
        {confirm?.type === 'replaceAssignment' ? <p className="break-all text-slate-100">Asignación: {confirm.form.assignmentId}</p> : <p className="text-slate-100">{confirm?.label}</p>}
      </Modal>
    </main>
  )
}
