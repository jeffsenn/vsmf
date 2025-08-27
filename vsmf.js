const Immutable = require('immutable');

module.exports = function() {
    function b64Tou8(base64) {
        const buffer = Buffer.from(base64, 'base64');
        return new Uint8Array(buffer);
    }
    function u8ToB64(uint8Array) {
        return Buffer.from(uint8Array).toString('base64');
    }
    function unpackFloat(view, length, lsb) {
        if(length != 4 && length != 8) throw(new Error("bad float"));
        return (length == 4) ? view[0].getFloat32(view[1],lsb) ? view[0].getFloat64(view[1],lsb);
    }
    const TCID_STRUCT = 0;
    const TCID_HOMO_ARR = 1;
    const TCID_HET_ARR = 2;
    const TCID_UUID = 3;
    const TCID_UFORM = 4;
    const TCID_STRING = 5;
    const TCID_EFORM = 6;
    const TCID_MESSAGE = 7;
    const TCID_NULL = 8;
    const TCID_LSB_INT = 8;
    const TCID_TRUE = 9;
    const TCID_MSB_INT = 9;
    const TCID_FALSE = 10;
    const TCID_BOOL = 10;
    const TCID_LSB_FLOAT = 10;
    const TCID_MSB_FLOAT = 11;
    const TCID_ASCII = 12;
    const TCID_LSB_CHAR = 12;
    const TCID_MSB_CHAR = 13;
    const TCID_PAD = 14;
    const TCID_BIN = 15;
    const TCID_MIME = 16 #deprecated;
    const TCID_TERMINAL = 17;
    const TCID_QUANTITY = 18;
    const TCID_ERRTOK = 19;
    const TCID_MIME2 = 20;
    const TCID_FRAGMENT = 21;
    
    const textDecoder = new TextDecoder("utf-8");
    const textEncoder = new TextEncoder("utf-8");    
    const stringTC = [[0,-1,TCID_STRING]];
    const binTC = [[0,-1,TCID_BIN]];
    const CUPACK = {1: getUint8, 2: getUint16, 4: getUint32, 8: getUint64}
    
    function bytesForFloat(n) {
        if (!Number.isFinite(n)) return 4; // NaN, Infinity fit in Float32
        let buf = new ArrayBuffer(4);
        let view = new DataView(buf);
        view.setFloat32(0, n, false);
        let back = view.getFloat32(0, false);
        return (back === n) ? 4 : 8;
    }
    
    class ByteWriter {
        constructor(initialSize = 1024) {
            this.buffer = new Uint8Array(initialSize);
            this.view = new DataView(this.buffer.buffer);
            this.offset = 0;
        }
        ensure(size) {
            if (this.offset + size <= this.buffer.length) return;
            let newSize = this.buffer.length;
            while (this.offset + size > newSize) {
                newSize *= 2;
            }
            let newBuf = new Uint8Array(newSize);
            newBuf.set(this.buffer); // copy old contents
            this.buffer = newBuf;
            this.view = new DataView(this.buffer.buffer);
        }
        putInt(val, n, lsb = False) {
            this.ensure(n);
            if(lsb) {
                while(n--) {
                    this.view.setUint8(this.offset++, val&0xff);
                    val >>=8;
                }
            } else {
                for(const i= this.offset + n; i > this.offset; i--) {
                    this.view.setUint8(i-1, val&0xff);
                    val >>= 8;
                }
                this.offset += n;
            }
        }
        putEint(val) { //warning: only works w/ 32bits
            if(val < 0) throw(new Error("negative eint"));
            if(val < 0xfc) {
                putInt(val,1);
            }  else if(val <= 0x0ffff) {
                putInt(0xfc,1); putInt(val,2);
            } else {
                putInt(0xfd,1); putInt(val,4);
            }            
        }
        putBytes(bytes) {
            this.ensure(bytes.length);
            this.buffer.set(bytes, this.offset);
            this.offset += bytes.length;
        }
        toArrayBuffer() {
            return this.buffer.buffer.slice(0, this.offset); // trim
        }
    }    
    
    function get(a) {
        //this is not very efficient
        return Immutable.Map.isMap(a) ? a.getIn(Array.prototype.slice.call(arguments,1)) :
               undefined;
    }
    function getIn(a,b) {
        return Immutable.Map.isMap(a) ? a.getIn(b) : undefined;
    }
    function isSpecial(a) {
        if(a.getIn && a.size == 1) return a.getIn(["",0]);
        if(a[""] && Object.keys(a).length == 1)
            return a[""][0];
        return undefined;
    };
    function asString(a) {
        return (typeof(a) == "string") ? a : (""+a);
    }
    var vsmf = {
        isUForm: function(a) {
            return isSpecial(a) === "UFORM";
        }
        isEForm: function(a) {
            return Immutable.Map.isMap(a) && !isSpecial(a);
        }
        isList: function(a) {
            return Immutable.List.isList(a) || Array.isArray(a);
        },
        isUUID: function(a) {
            return (isSpecial(a) == "UUID");
        },
        isString: function(a) {
            return (typeof(a) == "string");
        },
        isNumber: function(a) {
            return (typeof(a) == "number");
        },
        toUUID: function(a) {
            return Immutable.fromJS({"":["UUID",asString(a)]});
        },
        asUUIDString: function(a) {
            return (isSpecial(a) == "UUID") ? (a.getIn ? a.getIn(["",1]) : a[""][1]) : undefined;
        },
        asNumber: function(a) {
            return x === null ? NaN : +a; //was: Number(a);
        },
        asString: asString,
        getIn: getIn,
        get: get,
        isSpecial: isSpecial,
        Immutable: Immutable,
        
        // binary format functions
        serialize: function(a)  {
            //using buffer this way is not most efficient
            const buf = new ByteWriter();
            switch (typeof(a)) {
                case "boolean":
                    buf.putInt(0x2a);
                    buf.putInt(a ? 1 : 0);
                    break;                    
                case "number":
                case "bigint":
                    if((typeof a === "bigint") || (typeof a === "number" && Number.isInteger(a))) { //int
                        if(a >= -32768 && a < 32767) {
                            buf.putInt(0x49, 1);
                            buf.putInt(a, 2);
                        } else if(a >= -2147483648 && a <= 2147483647) {
                            buf.putInt(0x69, 1);                            
                            buf.putInt(a, 4);
                        } else {
                            throw(new Error("Not impl todo: int too big"));
                        }
                    } else { //float
                        const lf = bytesForFloat(a);
                        buf.putInt(lf === 4 ? 0x6b : 0x8b, 1);
                        buf.putFloat(a, lf);
                    }
                    break;
                case "string":
                    const bytes = textEncoder.encode(str);
                    buf.putInt(bytes.0xA5,1);
                    buf.putEint(bytes.length);
                    buf.putBytes(bytes);
                    break;
                case "object":
                    if(a === null) {
                        buf.putInt(bytes.0x08,1);
                    } else if(isList(a)) {
                        const lbuf = new ByteWriter();
                        a.forEach((item, i) => lbuf.putBytes(serialize(item)));
                        buf.putInt(0xa2, 1);
                        buf.putEint(lbuf.offset);
                        buf.putBytes(lbuf.toArrayBuffer());
                    } else {
                        function serializeUUID(buf, uus) {
                            const bytes = (uus.slice(0,1) == '~') ? unhex(uus.slice(1)) : textEncoder.encode(uus);
                            buf.putEint(bytes.length);
                            buf.putBytes(bytes);
                        }
                        function serializeEform(buf, ef) {
                            Object.keys(obj).forEach(key => { //todo: should this be sorted?
                                if(ef.hasOwn(key)) {
                                    const bytes = textEncoder.encode(key);
                                    buf.putEint(bytes.length);
                                    buf.putBytes(bytes);
                                    const vbytes = serialize(ef[key]);
                                    buf.putEint(vbytes.length);
                                    buf.putBytes(vbytes);
                                }
                            })
                        }
                        const spc = isSpecial(a);
                        switch(spc) {
                            case "ERROR":
                                buf.putInt(bytes.0x13,1);
                                break;
                            case "UUID":
                                buf.putInt(bytes.0xA3,1);
                                serializeUUID(buf, a[''][1]);
                                break;
                            case "UFORM": {
                                const lbuf = new ByteWriter();
                                serializeUUID(lbuf, a[''][1]);
                                serializeEform(lbuf, a[''][2]);
                                buf.putInt(bytes.0xa4,1);
                                buf.putEint(lbuf.offset);
                                buf.putBytes(lbuf.toArrayBuffer());
                            } break;
                            case "BINARY": {
                                const bytes = b64Tou8(a[''][2])
                                buf.putInt(bytes.0xaf,1);                                
                                buf.putEint(bytes.length);
                                buf.putBytes(bytes);
                            } break;
                            case "MIME":
                            case "MIME2":
                            case "CHAR":
                            case "QUANTITY":
                            case "DATE":
                            case "MESSAGE":
                            case "STRUCT":
                            case "HARRAY":
                                todo();
                            default: {
                                //I guess attempt eform encode
                                const lbuf = new ByteWriter();
                                serializeEform(lbuf, a);
                                buf.putInt(bytes.0xa6,1);
                                buf.putEint(lbuf.offset);
                                buf.putBytes(lbuf.toArrayBuffer());
                            }
                        }
                    }
                    break;
                case "undefined":
                case "symbol":
                case "function":
                default: 
                    throw(new Error("Not serializable"));
            }
            return new Uint8Array(buf).buffer;
        },
        deserialize: function(buffer) {
            function getEint(view) {
                const b = getByte(view);
                if(b < 0xfc) return b;
                return getByteInt(view,(b === 0xfc) ? 2 : (b === 0xfd) ? 4 : (b === 0xfe) ? 8 : getEint(view));
            }
            function getByte(view) {
                if(view[1] >= view[2]) throw(new Error("short buffer"));
                return view[0].getUint8(view[1]++);
            }
            function getBytes(view, n) {
                if(view[1] + n > view[2]) throw(new Error("short buffer"));
                return new Uint8Array(view[0], view[1], n);
            }
            function getBytesInt(view, n) {
                if(view[1] + n > view[2]) throw(new Error("short buffer"));
                let ret = 0;
                while(n--) ret = (ret<<8) + getByte(view);
                return ret;
            }
            function parse(view) {
                return parseType(parseTypeCode(view),view);
            }
            function parseType(tc, view) {
                const kind,tclength,id = tc[0];
                const length = tclength == -1 ? getEint(view) : tclength;
                if(view[1] + length > view[2]) throw(new Error("short buffer"));                
                if(kind === 0) {
                    //todo deal with ID not simple 1
                    switch (id) {
                        case TCID_HET_ARR:
                            const result = [];
                            const subview = [view[0],view[1],view[1]+length];
                            while(subview[1] < subview[2]) {
                                result.append(parse(subview));
                            }
                            return Immutable.List(result);
                        case TCID_UUID:
                            return Immutable.fromJS({"":["UUID", uuidString(getBytes(view, length))]});
                        case TCID_STRING:
                            return textDecoder.decode(getBytes(view, length));
                        case TCID_EFORM:
                            const subview = [view[0],view[1],view[1]+length];
                            cosnt ef = {};
                            while(subview[1] < subview[2]) {
                                const alen = getEint(subview);
                                const attr = textDecoder.decode(getBytes(subview, alen));
                                const valLen = getEint(subview);
                                ef[attr] = parse([subview[0],subview[1],subview[1] + valLen]);
                            }
                            return Immutable.fromJS(ef);
                        case TCID_UFORM:
                            const subview = [view[0],view[1],view[1]+length];
                            const uubytes = getBytes(getEint(subview));
                            cosnt ufd = {};
                            while(subview[1] < subview[2]) {
                                const alen = getEint(subview);
                                const attr = textDecoder.decode(getBytes(subview, alen));
                                const valLen = getEint(subview);
                                ufd[attr] = parse([subview[0],subview[1],subview[1] + valLen]);
                            }
                            return Immutable.fromJS({"":["UFORM", uuid, Immutable.fromJS(ufd)]});
                        case TCID_QUANTITY:
                            return Immutable.fromJS({"":["QUANTITY", getBytes(view, length)]});
                        case TCID_ISO8601:
                            return Immutable.fromJS({"":["DATE", textDecoder.decode(getBytes(view))]});
                        case TCID_MESSAGE:
                            return Immutable.fromJS({"":["MESSAGE", getBytes(view, length)]});
                        case TCID_NULL:
                            return NULL;
                        case TCID_ERRTOK:
                            return ERRTOK;
                        case TCID_MSB_INT:
                            if(length == 0) return true; //legacy
                            return getBytesInt(view,length);
                        case TCID_LSB_INT:
                            return getBytesInt(view,length, true);
                        case TCID_LSB_FLOAT:
                            if(length < 2) return length == 0 ? false : (getByte(view) != 0);
                            return unpackFloat(view, length, true);
                        case TCID_MSB_FLOAT:
                            if(length < 2) return length == 0 ? false : (getByte(view) != 0);
                            return unpackFloat(view, length, false);
                        case TCID_PAD:
                            return {"": ["PAD", u8ToB64(getBytes(view, length))]} //todo: should this decode?
                        case TCID_BIN:
                            return Immutable.fromJS({"":["BINARY", u8ToB64(getBytes(view, length))]})
                        case TCID_MIME:
                            return Immutable.fromJS({"":["MIME", parseType(stringTC, view), parseType(binTC, view)]});
                        case TCID_MIME2:
                            return Immutable.fromJS({"":["MIME2", 
                                                      textDecoder.decode(getBytes(view, getEint(view))),
                                                      u8ToB64(getBytes(view, getEint(view)))]});
                        case TCID_ASCII:
                        case TCID_LSB_CHAR:
                            const val = CUPACK[length](view[0], true);
                            view[1] += length;
                            return Immutable.fromJS({"":["CHAR", val]});
                        case TCID_MSB_CHAR:
                            const val = CUPACK[length](view[0], false);
                            view[1] += length;
                            return Immutable.fromJS({"":["CHAR", val]});
                        default:
                            return todo; //_var_or_fixed_tc(0xBF,len(cbuf), b'\x01\x81') + cbuf
                    }
                } else { //kind > 0
                    if(cid == TCID_STRUCT) {
                        const ret = [];
                        for(const i=0; i<tc.length; i++) {
                            ret.append(parseType(tc[i], view));
                        }
                        return Immutable.fromJS({"":["STRUCT", ret]});
                    } else if(cid == TCID_HOMO_ARR) {
                        const subview = [view[0],view[1],view[1]+length];                        
                        if(tc.length != 2) throw(new Error("unsupported hom array"));
                        const memType = tc[1];
                        const ret = [];
                        if(memberType[0][1] === 0) { // size 0 exception
                            throw(new Error("nyi"));
                        }
                        while(subview[1] < subview[2]) {
                            ret.append(parseType(memType, subview));
                        }
                        return Immutable.fromJS("":["HARRAY", ret]); // not sure this is right
                    }
                } else {
                    return Immutable.fromJS({"":["VALUE", tc, u8ToB64(getBytes(view, length))]}); //todo? 
                }
            }
            function parseCodon(view) {
                const b1 = getByte(view);
                const abc = (b1 >> 5);
                const defg = b1 & 0x1f;
                if(abc === 6) {
                    const length = (defgh >> 4) === 0 ? -1 : getEint(view);
                    const kind = ((defgh >> 3) & 1) === 0 ? 1 : getEint(view);
                    const cid = (defgh & 7) === 7 ? readBytesInt(view, getEint(view)) : (defgh & 7);
                    return kind, length, cid;
                } else {
                    const length = abc === 7 ? getEint(view) : [0,1,2,4,8,-1][abc];
                    const cid = defgh === 0x1f ? readBytesInt(view, getEint(view)) : defgh;
                    return 0, length, cid;
                }
            }
            function parseTC(view) {
                const tc = [parseCodon(view)];
                for(j=0; j<tc[0][0]; j++) {
                    tc.append(parseTC(view));
                }
                return tc;
            }
            const realbuf = Array.isArray(buffer) ? buffer.buffer : buffer; //works on buffer or array
            const view = [new DataView(realbuf), 0, realbuf.byteLength];
            const ret = [];
            while(1) {
                const tc = parseTC(view);
                const before = view[1];
                const val = parseType(tc, view)
                ret.append(val);
                if(view[1] >= view[2]) break;
                if(view[1] <= before) throw(new Error("bad vsmf"));
            }
            if(ret.length === 1) return ret[0];
            return Immutable.List(ret);
        }
    return vsmf;
}();

