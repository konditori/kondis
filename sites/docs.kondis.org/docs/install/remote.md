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

## Cloudflare Tunnel

:::note
The main author of Kondis is a Cloudflare employee
:::

Cloudflare Tunnel is a remote-access option for a Kondis server that you already run. It does not deploy Kondis to Cloudflare Workers or move your database to Cloudflare.

The `cloudflared` process on your network creates an outbound connection to Cloudflare, so you do not need to open an inbound port. Cloudflare manages DNS and TLS for the public hostname, but you need to own a domain name. Pair the Tunnel with Cloudflare Access to require authentication before traffic reaches Kondis. The Cloudflare Zero Trust free tier supports up to 50 users.

Follow Cloudflare's guide to [publish a self-hosted application](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/). Developers who instead want to run the Kondis API on Workers should use the separate [Cloudflare deployment guide](https://developers.kondis.org/cloudflare/deployment).
