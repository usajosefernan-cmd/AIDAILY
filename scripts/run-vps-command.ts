const token = 'pecemi_secure_gateway_token_2026_xyz';
const vpsUrlBase = 'https://pecemi-default-rtdb.firebaseio.com/aidaily';

async function execute(command: string, cwd = '/home/ubuntu/workspace/AIDAILY') {
  const reqId = "cmd_agent_" + Date.now();
  const reqUrl = `${vpsUrlBase}/bridge_requests/${reqId}.json`;
  const respUrl = `${vpsUrlBase}/bridge_responses/${reqId}.json`;

  console.log(`[VPS Exec] Enviando comando: "${command}"...`);

  try {
    const res = await fetch(reqUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: "run_terminal_command",
        params: {
          command: command,
          cwd: cwd
        },
        security_token: token,
        timestamp: Date.now()
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    console.log('[VPS Exec] Petición enviada. Esperando respuesta de la VPS...');
    const startTime = Date.now();
    const timeout = 30000; // 30s

    while (Date.now() - startTime < timeout) {
      const checkRes = await fetch(respUrl);
      if (checkRes.ok) {
        const respData: any = await checkRes.json();
        if (respData) {
          if (respData.success) {
            console.log('\n=== OUTPUT STDOUT ===');
            console.log(respData.data?.stdout || '(Vacío)');
            if (respData.data?.stderr) {
              console.log('=== OUTPUT STDERR ===');
              console.log(respData.data.stderr);
            }
          } else {
            console.error(`[Error VPS] La VPS falló al ejecutar: ${respData.error}`);
          }
          
          // Limpiar bridge
          await fetch(reqUrl, { method: 'DELETE' });
          await fetch(respUrl, { method: 'DELETE' });
          return;
        }
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    console.warn('[VPS Exec] Tiempo de espera agotado.');
  } catch (err: any) {
    console.error('[VPS Exec] Error:', err.message || err);
  }
}

const commandArg = process.argv.slice(2).join(' ');
if (!commandArg) {
  console.log('Uso: npx tsx scripts/run-vps-command.ts "<comando>"');
  process.exit(1);
}

execute(commandArg);
