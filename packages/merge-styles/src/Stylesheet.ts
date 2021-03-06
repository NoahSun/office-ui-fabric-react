import { IStyle } from './IStyle';
/**
 * Injection mode for the stylesheet.
 *
 * @public
 */
export const enum InjectionMode {
  /**
   * Avoids style injection, use getRules() to read the styles.
   */
  none = 0,

  /**
   * Inserts rules using the insertRule api.
   */
  insertNode = 1,

  /**
   * Appends rules using appendChild.
   */
  appendChild = 2
}

/**
 * Stylesheet config.
 *
 * @public
 */
export interface IStyleSheetConfig {
  /**
   * Injection mode for how rules are inserted.
   */
  injectionMode?: InjectionMode;
  /**
   * Falls back to "css".
   */
  defaultPrefix?: string;
  onInsertRule?: (rule: string) => void;
}

const STYLESHEET_SETTING = '__stylesheet__';

let _stylesheet: Stylesheet;

/**
 * Represents the state of styles registered in the page. Abstracts
 * the surface for adding styles to the stylesheet, exposes helpers
 * for reading the styles registered in server rendered scenarios.
 *
 * @public
 */
export class Stylesheet {
  private _styleElement?: HTMLStyleElement;
  private _rules: string[] = [];
  private _config: IStyleSheetConfig;
  private _rulesToInsert: string[] = [];
  private _counter = 0;
  private _keyToClassName: { [key: string]: string } = {};

  // tslint:disable-next-line:no-any
  private _classNameToArgs: { [key: string]: { args: any, rules: string[] } } = {};

  /**
   * Gets the singleton instance.
   */
  public static getInstance(): Stylesheet {
    // tslint:disable-next-line:no-any
    const win: any = typeof window !== 'undefined' ? window : {};
    _stylesheet = win[STYLESHEET_SETTING] as Stylesheet;

    if (!_stylesheet) {
      // tslint:disable-next-line:no-string-literal
      const fabricConfig = (win && win['FabricConfig']) || {};

      _stylesheet = win[STYLESHEET_SETTING] = new Stylesheet(fabricConfig.mergeStyles);
    }

    return _stylesheet;
  }

  constructor(config?: IStyleSheetConfig) {
    this._config = {
      injectionMode: InjectionMode.insertNode,
      defaultPrefix: 'css',
      ...config
    };
  }

  /**
   * Configures the stylesheet.
   */
  public setConfig(config?: IStyleSheetConfig): void {
    this._config = {
      ...this._config,
      ...config
    };
  }

  /**
   * Generates a unique classname.
   *
   * @param displayName - Optional value to use as a prefix.
   */
  public getClassName(displayName?: string): string {
    const prefix = displayName || this._config.defaultPrefix;

    return `${prefix}-${this._counter++}`;
  }

  /**
   * Used internally to cache information about a class which was
   * registered with the stylesheet.
   */
  public cacheClassName(
    className: string,
    key: string,
    args: IStyle[],
    rules: string[]
  ): void {
    this._keyToClassName[key] = className;
    this._classNameToArgs[className] = {
      args,
      rules
    };
  }

  /**
   * Gets the appropriate classname given a key which was previously
   * registered using cacheClassName.
   */
  public classNameFromKey(key: string): string | undefined {
    return this._keyToClassName[key];
  }

  /**
   * Gets the arguments associated with a given classname which was
   * previously registered using cacheClassName.
   */
  public argsFromClassName(className: string): IStyle[] | undefined {
    const entry = this._classNameToArgs[className];

    return (entry && entry.args);
  }

  /**
 * Gets the arguments associated with a given classname which was
 * previously registered using cacheClassName.
 */
  public insertedRulesFromClassName(className: string): string[] | undefined {
    const entry = this._classNameToArgs[className];

    return (entry && entry.rules);
  }

  /**
   * Inserts a css rule into the stylesheet.
   */
  public insertRule(
    rule: string
  ): void {
    const element = this._getElement();
    const injectionMode = element ? this._config.injectionMode : InjectionMode.none;

    switch (injectionMode) {
      case InjectionMode.insertNode:
        const { sheet } = element!;

        try {
          // tslint:disable-next-line:no-any
          (sheet as any).insertRule(rule, (sheet as any).cssRules.length);
        } catch (e) {
          /* no-op on errors */
        }
        break;

      case InjectionMode.appendChild:
        _createStyleElement(rule);
        break;

      default:
        this._rules.push(rule);
        break;
    }

    if (this._config.onInsertRule) {
      this._config.onInsertRule(rule);
    }
  }

  /**
   * Gets all rules registered with the stylesheet; only valid when
   * using InsertionMode.none.
   */
  public getRules(): string {
    return (this._rules.join('') || '') + (this._rulesToInsert.join('') || '');
  }

  /**
   * Resets the internal state of the stylesheet. Only used in server
   * rendered scenarios where we're using InsertionMode.none.
   */
  public reset(): void {
    this._rules = [];
    this._rulesToInsert = [];
    this._counter = 0;
    this._classNameToArgs = {};
    this._keyToClassName = {};
  }

  // Forces the regeneration of incoming styles without totally resetting the stylesheet.
  public resetKeys(): void {
    this._keyToClassName = {};
  }

  private _getElement(): HTMLStyleElement | undefined {
    if (!this._styleElement && typeof document !== 'undefined') {
      this._styleElement = _createStyleElement();
    }
    return this._styleElement;
  }
}

function _createStyleElement(content?: string): HTMLStyleElement {
  const styleElement = document.createElement('style');

  styleElement.setAttribute('data-merge-styles', 'true');
  styleElement.type = 'text/css';
  if (content) {
    styleElement.appendChild(document.createTextNode(content));
  }
  document.head.appendChild(styleElement);

  return styleElement;
}