export namespace main {
	
	export class AppSettings {
	    displayName: string;
	    autoUpdate: boolean;
	    vlinkAutoStart: boolean;
	    notes: string;
	    pomodoroNotifyDesktop: boolean;
	    pomodoroNotifySound: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.displayName = source["displayName"];
	        this.autoUpdate = source["autoUpdate"];
	        this.vlinkAutoStart = source["vlinkAutoStart"];
	        this.notes = source["notes"];
	        this.pomodoroNotifyDesktop = source["pomodoroNotifyDesktop"];
	        this.pomodoroNotifySound = source["pomodoroNotifySound"];
	    }
	}
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

