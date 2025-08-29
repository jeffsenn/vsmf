const net = require("net");
const WebSocket = require("ws");
const vsmf = require("../vsmf");
const LISTEN_PORT = 9000; 

function json2binary(data, targetSocket) {
    targetSocket.send(data);
}
function binary2json(data, clientSocket) {
    clientSocket.send(data);    
}

const wss = new WebSocket.Server({ port: LISTEN_PORT }, () => {
    console.log(`WebSocket proxy listening on ws://localhost:${LISTEN_PORT}`);
});

function handleincoming(ws, data, state) {
    if(state.offset + data.byteLength > state.size) {
        let newSize = data.byteLength + state.offset;
        let newBuf = new Uint8Array(newSize);
        if(state.offset > 0) newBuf.set(state.buffer);
        state.buffer = newBuf;
        state.size = newSize;
    }
    state.buffer.set(data, state.offset);
    state.offset += data.byteLength;
    const dv = new DataView(state.buffer.buffer);
    while(state.offset >= state.waiting) {
        if(state.state === 0) {
            const newwaiting = dv.getUint32(0);
            if(state.offset > state.waiting) {
                state.buffer.set(state.buffer.slice(state.waiting, state.offset), 0);
            }
            state.state = 1;
            state.offset -= state.waiting;
            state.waiting = newwaiting;
        } else {
            ws.send(JSON.stringify(vsmf.deserialize(state.buffer.slice(0,state.offset))));
            if(state.offset > state.waiting) {
                state.buffer.set(state.buffer.slice(state.waiting, state.offset), 0);
            }
            state.state = 0;
            state.offset -= state.waiting;
            state.waiting = 4;
        }
    }
}

wss.on("connection", (ws, req) => {
    console.log(`WebSocket client connected from ${req.socket.remoteAddress}:${req.socket.remotePort}`);
    let state = {
        waiting : 4,
        state : -1,
        offset : 0,
        size : 1000,
        buffer : new Uint8Array(1000)
    }
    let targetSocket = null;
    ws.on("message", (message) => {
        console.log(`WS → TCP: ${message.toString("hex")} | "${message.toString()}"`);
        if(state.state === -1) { //first message is host:port to connect
            const [TARGET_HOST, TARGET_PORTs] = message.toString().split(":");
            const TARGET_PORT = parseInt(TARGET_PORTs,10);
            targetSocket = net.createConnection(
                { host: TARGET_HOST, port: TARGET_PORT },
                () => { console.log(`Connected to target ${TARGET_HOST}:${TARGET_PORT}`); }
            );
            state.state = 0;
            targetSocket.on("data", (data) => {
                console.log(`TCP → WS: ${data.toString("hex")} | "${data.toString()}"`);
                handleincoming(ws, data, state);
            });
            targetSocket.on("close", () => {
                console.log("Target disconnected");
                ws.close();
            });
            targetSocket.on("error", (err) => console.error("Target error:", err));
            return;
        } 
        const data = vsmf.serialize(JSON.parse(message))
        const buffer = new ArrayBuffer(4);
        new DataView(buffer).setInt32(0, data.byteLength)
        targetSocket.write(new Uint8Array(buffer));
        console.log("send", buffer);
        console.log("send", data);
        targetSocket.write(data);
    });
    ws.on("close", () => {
        console.log("WebSocket client disconnected");
        targetSocket.end();
    });
    ws.on("error", (err) => console.error("WebSocket error:", err));
});

