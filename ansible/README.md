# 🔧 Ansible: configuración automática del Edge (tarea 33)

> Actividad **3.3.1** y criterio 2 de la **Nota 3** (Pipeline DevOps): cómo se deja igual cada equipo de sede sin configurarlo a mano.

## Qué es y para qué sirve

**Ansible** configura muchos equipos a la vez desde un solo computador, por **SSH**, sin instalar nada en ellos. Lo que se quiere que quede en cada equipo se escribe una vez en un **playbook**. Si se corre de nuevo y todo ya está bien, **no cambia nada** (eso es la **idempotencia**).

En Induplac sirve para instalar el **Edge** igual en cada sede: si mañana se agrega una sede o se cambia una Raspberry, basta con sumarla al inventario y correr el playbook.

```text
PC de Abraham (Windows)
 └─ WSL Ubuntu = NODO DE CONTROL (Ansible + inventario + playbook)
       │ SSH (llave del Learner Lab)
       ├──► EC2 "edge-planta"    (Ubuntu) = Raspberry de Planta    · local1
       └──► EC2 "edge-oficinas"  (Ubuntu) = Raspberry de Oficinas  · local2
```

> En el diseño hay **una Raspberry Pi por sede**. Para la Nota 3 se simulan con 2 EC2 del Learner Lab.

## Archivos

| Archivo | Qué es |
|---|---|
| [`inventario.ini`](inventario.ini) | Los nodos administrados: nombre, IP, sede y `local_id` |
| [`group_vars/edge.yml`](group_vars/edge.yml) | Variables comunes: zona horaria, rutas, versión del código, paquetes, broker y API |
| [`edge-baseline.yml`](edge-baseline.yml) | **El playbook**: deja el Edge listo |
| [`templates/`](templates/) | Plantillas del `edge/.env` (una por sede) y del servicio de Linux |
| [`limpieza.yml`](limpieza.yml) | Deshace todo (para empezar de cero o después de la presentación) |
| [`secretos.example.yml`](secretos.example.yml) | Plantilla de las claves. La real (`secretos.yml`) **nunca se sube** |
| [`ansible.cfg`](ansible.cfg) | Usuario `ubuntu`, llave `~/.ssh/labsuser.pem` e inventario por defecto |

## Qué hace el playbook en cada sede

| # | Tarea | Por qué |
|---|---|---|
| 1 | Zona horaria `America/Santiago` | Los intervalos de 15 min y la auditoría usan la hora local |
| 2 | Paquetes: Python 3, venv, git, sqlite3, chrony, acl | Lo mínimo para correr el Edge |
| 3 | Hora sincronizada por NTP (chrony) | Una Raspberry no tiene reloj con batería: sin NTP la hora se corre |
| 4 | Usuario de sistema `induplac` (sin login) | El Edge no corre como root (mínimo privilegio) |
| 5 | Código desde GitHub en `/opt/induplac/repo` (versión `main`) | **Se sabe qué versión quedó en cada sede** (el resumen muestra el commit) |
| 6 | Entorno de Python con `edge/requirements.txt` | Dependencias aisladas del sistema |
| 7 | `edge/.env` desde una plantilla, con la sede de cada equipo | Misma configuración, cambia solo lo de cada sede. Permisos `0600` |
| 8 | Servicio `induplac-edge` (systemd) | El Edge arranca solo al prender el equipo y se reinicia si falla |
| 9 | Servicio habilitado (corriendo solo si hay claves) | Sin claves queda instalado pero detenido, para no fallar en bucle |
| 10 | Resumen de la sede | Sede, versión instalada y estado del servicio |

Si cambia el código, la configuración o el servicio, el Edge **se reinicia solo** (handler `Reiniciar Edge`).

---

## Paso a paso

### 0. Una vez: Ansible en WSL

```bash
sudo apt update
sudo apt install -y ansible openssh-client
ansible --version
```

### 1. Las EC2 (Felipe, en el Learner Lab)

- **EC2 → Launch instance:** Ubuntu (LTS por defecto) · `t3.micro` · key pair **vockey** · *Allow SSH traffic* · *Number of instances:* **2**.
- Nombres: `edge-planta` y `edge-oficinas`.
- Copiar la **Public IPv4 address** de cada una.
- **AWS Details → Download PEM** (`labsuser.pem`) y pasarla **por privado**.

### 2. La llave en WSL

```bash
cp /mnt/c/Users/<tu_usuario_windows>/Downloads/labsuser.pem ~/.ssh/
chmod 600 ~/.ssh/labsuser.pem
```

### 3. Las IP en el inventario

En [`inventario.ini`](inventario.ini), reemplaza `REEMPLAZAR_IP_PLANTA` y `REEMPLAZAR_IP_OFICINAS`. **No subas las IP al repo** (cambian cada vez que el lab se reinicia).

### 4. Evidencias (sacar captura de cada una)

Todo desde la carpeta `ansible/`:

```bash
cd ~/Induplac/ansible
```

| # | Evidencia | Comando | Qué tiene que salir |
|---|---|---|---|
| 1 | **Inventario** | `ansible-inventory --graph` | El grupo `@edge` con `edge-planta` y `edge-oficinas` |
| 2 | **Conexión** | `ansible edge -m ping` | `"ping": "pong"` en verde en las dos |
| 3 | **Playbook** | `ansible-playbook edge-baseline.yml` | Tareas en amarillo (`changed`) y el resumen de cada sede con la versión |
| 4 | **Idempotencia** | `ansible-playbook edge-baseline.yml` (otra vez) | `changed=0` en las dos sedes |
| 5 | Verificación | `ansible edge -a "systemctl is-enabled induplac-edge"` | `enabled` en las dos |

> **Opcional (Edge corriendo de verdad):** copia `secretos.example.yml` como `secretos.yml`, completa las claves de `edge/.env` y corre `ansible-playbook edge-baseline.yml -e @secretos.yml`. Después: `ansible edge -a "systemctl is-active induplac-edge"` → `active`.

### 5. Al terminar

```bash
ansible-playbook limpieza.yml      # deja las EC2 como nuevas
```

Detener las EC2 en la consola (*Instance state → Stop*) para no gastar crédito. El día de la presentación: abrir el lab antes, iniciarlas y actualizar las IP del inventario.

---

## Cómo se probó (17/11/2026)

El playbook se corrió dos veces contra un Ubuntu 24.04 limpio:

- **1ª pasada:** `ok=9 changed=5 failed=0`. Resumen: *"edge-planta (sede planta, local1): versión a06a10b, servicio instalado y detenido (faltan claves)"*.
- **2ª pasada:** `ok=9 changed=0 failed=0` → **idempotente**.
- `limpieza.yml` dejó el equipo sin el usuario `induplac` ni `/opt/induplac`.

Las tareas del servicio (3, 8 y 9) no se pudieron probar ahí porque ese entorno no tiene systemd; se prueban en las EC2.

## Para la presentación

- **Qué es:** configuración como código. El estado de cada equipo de sede está escrito en el repo, versionado con Git y revisado por PR, igual que el resto del proyecto.
- **Dónde va en el pipeline:** en la etapa **Despliegue / Operación**: GitHub Actions publica el dashboard y las Lambdas, y Ansible deja listos los Edge de las sedes.
- **Por qué importa la idempotencia:** el playbook se puede correr cada vez que se quiera revisar una sede. Si alguien cambió algo a mano, Ansible lo devuelve al estado correcto, y si no, no toca nada.
- **Seguridad:** el Edge corre con un usuario sin privilegios, las claves no están en el repo (`secretos.yml` ignorado por git, `.env` con permisos `0600`) y Ansible entra solo con llave SSH, sin contraseñas.
