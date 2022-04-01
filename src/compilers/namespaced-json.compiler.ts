import { CompilerInterface } from './compiler.interface.js';
import { TranslationCollection } from '../utils/translation.collection.js';
import { stripBOM } from '../utils/utils.js';

import pkg from 'flat';
const { flatten, unflatten } = pkg;

export class NamespacedJsonCompiler implements CompilerInterface {
	public indentation: string = '\t';
	public newlineAtEndOfFile = true;

	public extension = 'json';

	public constructor(options?: any) {
		if (options && typeof options.indentation !== 'undefined') {
			this.indentation = options.indentation;
		}
		if (options && typeof options.newlineAtEndOfFile !== 'undefined') {
			this.newlineAtEndOfFile = options.newlineAtEndOfFile;
		}
	}

	public compile(collection: TranslationCollection): string {
		const values: {} = unflatten(collection.values, {
			object: true
		});
		let json = JSON.stringify(values, null, this.indentation);
		if (this.newlineAtEndOfFile) {
			json += '\n';
		}
		return json;
	}

	public parse(contents: string): TranslationCollection {
		const values: {} = flatten(JSON.parse(stripBOM(contents)));
		return new TranslationCollection(values);
	}
}
