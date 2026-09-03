import { ConnectTUI, decodeKeys, type TUIIO } from './tui-app.ts';

const io: TUIIO = {
    write: (chunk) => process.stdout.write(chunk),
    getSize: () => ({ cols: process.stdout.columns ?? 80, rows: process.stdout.rows ?? 24 }),
    onKey: (handler) => {
        process.stdin.on('data', (chunk) => {
            for (const key of decodeKeys(chunk.toString())) handler(key);
        });
    },
    setRaw: (on) => {
        if (process.stdin.isTTY) process.stdin.setRawMode(on);
    },
    close: () => process.exit(0)
};

new ConnectTUI(io).start();
