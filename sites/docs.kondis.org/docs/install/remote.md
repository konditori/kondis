---
sidebar_position: 4
title: Remote access
---

# Remote access

The server is set up, but it is hard to reach outside of your network. A remote access setup lets you use Kondis from the Android app and other devices without exposing the server directly to the internet.

We recommend against port forwarding and other methods to expose your server on the public Internet unless you really know what you are doing. We strongly encourage you to setup TLS in order to get a `https://` URL in order to achieve strong encryption and authentication with your server.

## VPN

A VPN let you access your home network through an encrypted tunnel. Popular VPNs for remote access include Wireguard and Tailscale.

### Tailscale

Tailscale is a commercial product with a free tier suitable for home use. Tailscale has a [great video on connecting to self-hosted services](https://www.youtube.com/watch?v=Vt4PDUXB_fg).

### Wireguard

Wireguard is an open source VPN system that you can host yourself without relying on a third party.

## Cloudflare

:::note
The main author of Kondis is a Cloudflare employee
:::

Cloudflare Tunnels, also known as Cloudflare ZTNA, is a commercial zero-trust solution with a free tier that allows up to 50 users. You connect to Kondis through a `cloudflared` instance on your network. Cloudflare manages DNS and TLS for you automatically but you need to own a domain name. Official instructions are found [here](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
