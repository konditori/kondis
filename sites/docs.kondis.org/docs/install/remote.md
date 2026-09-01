---
sidebar_position: 4
title: Remote access
---

# Remote access

The server is set up, but it is hard to reach outside of your network. A remote access setup lets you use Kondis from the Android app and other devices without exposing the server directly to the internet.

We recommend against port forwarding and other methods to expose your server on the public Internet unless you really know what you are doing. We strongly encourage you to setup TLS in order to get a `https:///` URL in order to achieve strong encryption and authentication with your server.

## VPN

A VPN let you access Kondis through an encrypted tunnel. Great examples of VPNs include Wireguard and Openvpn.

## Tailscale

Tailscale allows you to connect to your home network even if your ISP is putting you behind a CGNAT.

## Cloudflare

:::note
The main author of Kondis is a Cloudflare employee
:::

A Cloudflare tunnel lets you connect to Kondis through a `cloudflared` instance on your network. If you also host your domain name on Cloudflare, you get out-of the box TLS certificates as well.

Next, add Cloudflare Access. This restricts access to Kondis to only the authenticated users you allow.

In Cloudflare Access, you must enable Managed Oauth to allow the mobile apps to log in.
