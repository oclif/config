// tslint:disable no-implicit-dependencies
import * as fs from 'fs'

const debug = require('debug')('@oclif/config')

export function flatMap<T, U>(arr: T[], fn: (i: T) => U[]): U[] {
  return arr.reduce((arr, i) => arr.concat(fn(i)), [] as U[])
}

export function mapValues<T extends object, TResult>(obj: {[P in keyof T]: T[P]}, fn: (i: T[keyof T], k: keyof T) => TResult): {[P in keyof T]: TResult} {
  return Object.entries(obj)
    .reduce((o, [k, v]) => {
      o[k] = fn(v as any, k as any)
      return o
    }, {} as any)
}

export function loadJSONSync(path: string): any {
  debug('loadJSONSync %s', path)
  // let loadJSON
  // try { loadJSON = require('load-json-file') } catch {}
  // if (loadJSON) return loadJSON.sync(path)
  return JSON.parse(fs.readFileSync(path, 'utf8'))
}

export function exists(path: string): Promise<boolean> {
  // tslint:disable-next-line
  return new Promise(resolve => fs.exists(path, resolve))
}

export function loadJSON(path: string): Promise<any> {
  debug('loadJSON %s', path)
  // let loadJSON
  // try { loadJSON = require('load-json-file') } catch {}
  // if (loadJSON) return loadJSON.sync(path)
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, d) => {
      try {
        if (err) reject(err)
        else resolve(JSON.parse(d))
      } catch (err) {
        reject(err)
      }
    })
  })
}

export function compact<T>(a: (T | undefined)[]): T[] {
  return a.filter((a): a is T => !!a)
}

export function uniq<T>(arr: T[]): T[] {
  return arr.filter((a, i) => {
    return !arr.find((b, j) => j > i && b === a)
  })
}
