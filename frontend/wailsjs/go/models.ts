export namespace main {
	
	export class GeminiAttachment {
	    name: string;
	    content: string;
	    isBinary: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GeminiAttachment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.content = source["content"];
	        this.isBinary = source["isBinary"];
	    }
	}

}

