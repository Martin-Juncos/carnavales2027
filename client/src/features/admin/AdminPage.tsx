import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api/adminApi'
import { ApiClientError } from '../../api/apiClient'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import type { Role } from '../../types/domain'

interface UserForm { nombre: string; dni: string; email: string; password: string; role: Role; activo: boolean }
interface NightForm { nombre: string; fecha: string }
interface ComparsaForm { nombre: string; nocheId: string; orden: string; activo: boolean }
interface ItemForm { nombre: string; parentItemId: string; orden: string; activo: boolean }
interface AssignmentForm { juradoId: string; nocheId: string; motivo: string }
interface ReplaceForm { assignmentId: string; replacementJurorId: string; motivo: string }

type ConfirmAction =
  | { type: 'openNight'; id: number; label: string }
  | { type: 'closeNight'; id: number; label: string }
  | { type: 'replaceAssignment'; form: ReplaceForm }

const initialUser: UserForm = { nombre: '', dni: '', email: '', password: '', role: 'jurado', activo: true }
const initialNight: NightForm = { nombre: '', fecha: '' }
const initialComparsa: ComparsaForm = { nombre: '', nocheId: '1', orden: '1', activo: true }
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
    mutationFn: () => adminApi.createComparsa({ nombre: comparsaForm.nombre, nocheId: Number(comparsaForm.nocheId), orden: Number(comparsaForm.orden), activo: comparsaForm.activo }),
    onSuccess: () => { setComparsaForm(initialComparsa); setMessage('Comparsa creada.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo crear la comparsa.')),
  })
  const createItem = useMutation({
    mutationFn: () => adminApi.createItem({
      nombre: itemForm.nombre,
      ...(itemForm.parentItemId ? { parentItemId: Number(itemForm.parentItemId) } : { parentItemId: null }),
      orden: Number(itemForm.orden),
      activo: itemForm.activo,
    }),
    onSuccess: () => { setItemForm(initialItem); setMessage('?tem creado.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo crear el ?tem.')),
  })
  const createAssignment = useMutation({
    mutationFn: () => adminApi.createAssignment({
      juradoId: assignmentForm.juradoId,
      nocheId: Number(assignmentForm.nocheId),
      ...(assignmentForm.motivo.trim() ? { motivo: assignmentForm.motivo.trim() } : {}),
    }),
    onSuccess: () => { setAssignmentForm(initialAssignment); setMessage('Asignaci?n creada.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo crear la asignaci?n.')),
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

  const busy = createUser.isPending || createNight.isPending || createComparsa.isPending || createItem.isPending || createAssignment.isPending || openNight.isPending || closeNight.isPending || replaceAssignment.isPending

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-5">
      {message ? <Card className="border-cyan-500/40 bg-cyan-500/10"><p className="text-cyan-100">{message}</p></Card> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-bold">Usuarios</h2>
          <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={onUser}>
            <input aria-label="Nombre" placeholder="Nombre" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={userForm.nombre} onChange={(event) => setUserForm({ ...userForm, nombre: event.target.value })} />
            <input aria-label="DNI" placeholder="DNI" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={userForm.dni} onChange={(event) => setUserForm({ ...userForm, dni: event.target.value })} />
            <input aria-label="Email" placeholder="Email" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
            <input aria-label="Contrase?a" placeholder="Contrase?a inicial" type="password" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} />
            <select aria-label="Rol" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value as Role })}><option value="jurado">Jurado</option><option value="fiscal">Fiscal</option><option value="escribano">Escribano</option><option value="admin">Admin</option></select>
            <Button type="submit" disabled={busy}>Crear usuario</Button>
          </form>
          <div className="mt-4 max-h-80 space-y-2 overflow-auto">
            {(users.data ?? []).map((user) => <div key={user.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm"><p className="font-semibold">{user.nombre}</p><p className="text-slate-400">{user.email} ? {user.role}</p></div>)}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Noches</h2>
          <form className="mt-3 grid gap-3 sm:grid-cols-3" onSubmit={onNight}>
            <input aria-label="Nombre de noche" placeholder="Nombre" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={nightForm.nombre} onChange={(event) => setNightForm({ ...nightForm, nombre: event.target.value })} />
            <input aria-label="Fecha" type="date" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={nightForm.fecha} onChange={(event) => setNightForm({ ...nightForm, fecha: event.target.value })} />
            <Button type="submit" disabled={busy}>Crear noche</Button>
          </form>
          <div className="mt-4 space-y-2">
            {(nights.data ?? []).map((night) => <div key={night.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm"><div><p className="font-semibold">#{night.id} ? {night.nombre}</p><p className="text-slate-400">{night.fecha}</p></div><Badge tone={night.estado === 'open' ? 'success' : 'warning'}>{night.estado}</Badge><div className="flex gap-2"><Button variant="secondary" onClick={() => setConfirm({ type: 'openNight', id: night.id, label: night.nombre })}>Abrir</Button><Button variant="danger" onClick={() => setConfirm({ type: 'closeNight', id: night.id, label: night.nombre })}>Cerrar</Button></div></div>)}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Comparsas</h2>
          <form className="mt-3 grid gap-3 sm:grid-cols-4" onSubmit={onComparsa}>
            <input aria-label="Nombre comparsa" placeholder="Nombre" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={comparsaForm.nombre} onChange={(event) => setComparsaForm({ ...comparsaForm, nombre: event.target.value })} />
            <input aria-label="Noche ID comparsa" placeholder="Noche ID" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={comparsaForm.nocheId} onChange={(event) => setComparsaForm({ ...comparsaForm, nocheId: event.target.value })} />
            <input aria-label="Orden comparsa" placeholder="Orden" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={comparsaForm.orden} onChange={(event) => setComparsaForm({ ...comparsaForm, orden: event.target.value })} />
            <Button type="submit" disabled={busy}>Crear comparsa</Button>
          </form>
          <div className="mt-4 max-h-80 space-y-2 overflow-auto">{(comparsas.data ?? []).map((comparsa) => <p key={comparsa.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm">#{comparsa.id} ? {comparsa.nombre} ? noche {comparsa.nocheId} ? orden {comparsa.orden}</p>)}</div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Rubros / ?tems</h2>
          <form className="mt-3 grid gap-3 sm:grid-cols-4" onSubmit={onItem}>
            <input aria-label="Nombre ?tem" placeholder="Nombre" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={itemForm.nombre} onChange={(event) => setItemForm({ ...itemForm, nombre: event.target.value })} />
            <input aria-label="?tem padre" placeholder="Padre opcional" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={itemForm.parentItemId} onChange={(event) => setItemForm({ ...itemForm, parentItemId: event.target.value })} />
            <input aria-label="Orden ?tem" placeholder="Orden" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={itemForm.orden} onChange={(event) => setItemForm({ ...itemForm, orden: event.target.value })} />
            <Button type="submit" disabled={busy}>Crear ?tem</Button>
          </form>
          <div className="mt-4 max-h-80 space-y-2 overflow-auto">{(items.data ?? []).map((item) => <p key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm">#{item.id} ? {item.nombre} ? padre {item.parentItemId ?? '-'} ? orden {item.orden}</p>)}</div>
        </Card>

        <Card className="xl:col-span-2">
          <h2 className="text-xl font-bold">Asignaciones y reemplazos</h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <form className="grid gap-3" onSubmit={onAssignment}>
              <input aria-label="Jurado ID" placeholder="Jurado ID" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={assignmentForm.juradoId} onChange={(event) => setAssignmentForm({ ...assignmentForm, juradoId: event.target.value })} />
              <input aria-label="Noche ID asignaci?n" placeholder="Noche ID" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={assignmentForm.nocheId} onChange={(event) => setAssignmentForm({ ...assignmentForm, nocheId: event.target.value })} />
              <input aria-label="Motivo asignaci?n" placeholder="Motivo opcional" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={assignmentForm.motivo} onChange={(event) => setAssignmentForm({ ...assignmentForm, motivo: event.target.value })} />
              <Button type="submit" disabled={busy}>Asignar jurado</Button>
            </form>
            <form className="grid gap-3" onSubmit={onReplace}>
              <input aria-label="Asignaci?n ID" placeholder="Asignaci?n ID activa" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={replaceForm.assignmentId} onChange={(event) => setReplaceForm({ ...replaceForm, assignmentId: event.target.value })} />
              <input aria-label="Jurado reemplazante ID" placeholder="Jurado reemplazante ID" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={replaceForm.replacementJurorId} onChange={(event) => setReplaceForm({ ...replaceForm, replacementJurorId: event.target.value })} />
              <input aria-label="Motivo reemplazo" placeholder="Motivo obligatorio" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={replaceForm.motivo} onChange={(event) => setReplaceForm({ ...replaceForm, motivo: event.target.value })} />
              <Button type="submit" variant="danger" disabled={busy || replaceForm.motivo.trim().length < 3}>Reemplazar jurado</Button>
            </form>
          </div>
          <div className="mt-4 max-h-96 space-y-2 overflow-auto">{(assignments.data ?? []).map((assignment) => <div key={assignment.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm"><p className="font-semibold">{assignment.juradoNombre} ? {assignment.nocheNombre}</p><p className="text-slate-400">{assignment.estado} ? {assignment.id}</p></div>)}</div>
        </Card>
      </div>

      <Modal
        open={Boolean(confirm)}
        title={confirm?.type === 'replaceAssignment' ? 'Reemplazar jurado' : confirm?.type === 'closeNight' ? 'Cerrar noche' : 'Abrir noche'}
        description="Acci?n operativa sensible: quedar? auditada en backend. Verific? que corresponde antes de confirmar."
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
        {confirm?.type === 'replaceAssignment' ? <p className="break-all text-slate-100">Asignaci?n: {confirm.form.assignmentId}</p> : <p className="text-slate-100">{confirm?.label}</p>}
      </Modal>
    </main>
  )
}
