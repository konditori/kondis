# Kondis PostgreSQL

This folder contains the build for PostgreSQL images to be used by Kondis.
They include the VectorChord extension.

## Building

To build the Dockerfile locally, you need to pass the `PG_MAJOR` and `VECTORCHORD_TAG` args. For example:
`docker build . --build-arg="PG_MAJOR=17" --build-arg="VECTORCHORD_TAG=0.3.0"`
