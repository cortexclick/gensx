#!/usr/bin/env node
import { config } from 'dotenv'
import { bgBlue, bold, red } from 'picocolors'
import '../src/index'

config()

console.log(
  bgBlue(
    `Welcome to ${bold(red('gensx-cli'))}!
    Bundle and deploy GenSX workflows to the cloud.`,
  ),
)
