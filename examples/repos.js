// tcp-client.js
const net = require("net");
const vsmf = require("../vsmf");
const HOSTNAME = "myhost.foo.com";
const PORT = 6201;

handleIncoming = function(cb, data) {
    let size = 10000;
    let state = 0;
    let waiting = 4;
    let buffer = new Uint8Array(size);
    let offset = 0;
    return function (cb, data) {
        if(offset + data.byteLength > size) {
            let newSize = data.byteLength + offset;
            let newBuf = new Uint8Array(newSize);
            if(offset > 0) newBuf.set(this.buffer);
            buffer = newBuf;
            size = newSize;
        }
        buffer.set(data, offset);
        offset += data.byteLength;
        const dv = new DataView(buffer.buffer);
        while(offset >= waiting) {
            if(state === 0) {
                const newwaiting = dv.getUint32(0);
                if(offset > waiting) {
                    buffer.set(buffer.slice(waiting, offset), 0);
                }
                state = 1;
                offset -= waiting;
                waiting = newwaiting;
            } else {
                cb(vsmf.deserialize(buffer.slice(0,offset)));
                if(offset > waiting) {
                    buffer.set(buffer.slice(waiting, offset), 0);
                }
                state = 0;
                offset -= waiting;
                waiting = 4;
            }
        }
    }
}();

function createTcpClient(host, port, onMessage) {
  const client = new net.Socket();

  client.connect(port, host, () => {
    console.log(`Connected to ${host}:${port}`);
  });
  client.on("data", (data) => {
        handleIncoming(onMessage, data);
  });

  client.on("close", () => {
    console.log("Connection closed");
  });
  client.on("error", (err) => {
    console.error("Socket error:", err.message);
  });
  function send(msg) {
      const data = vsmf.serialize(msg);
      const buffer = new ArrayBuffer(4);
      new DataView(buffer).setInt32(0, data.byteLength)
      client.write(new Uint8Array(buffer));
      client.write(data);
  }
    return {
    send,
    close: () => client.end(),
  };
}

// Example usage:
const client = createTcpClient(HOSTNAME, PORT, (msg) => {
  console.log("Received:", JSON.stringify(msg));
});

// Send a test message after connecting
setTimeout(() => {
    //client.send([1,{"":["UForm", "~014f7589a6839f11f0a3c4d1b380be4e71", {}]}]);
    client.send([1,{"":["UForm", "~014f7589a6839f11f0a3c4d1b380be4e72", {"client_type":["authenticated",1]}]}])
    client.send([8,{"":["UForm", "~01ed537064c50111e5908dfcb98b8b38b4", {"name": null}]}])    
    
}, 500);

