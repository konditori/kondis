#!/usr/bin/env bash

read_env_or_file() {
    local var_name="$1"
    local file_var_name="${var_name}_FILE"

    if [[ -n "${!file_var_name}" && -f "${!file_var_name}" && -s "${!file_var_name}" ]]; then
        cat "${!file_var_name}"
    else
        echo "${!var_name}"
    fi
}

: "${POSTGRES_USER_FILE:=${KONDIS_DB_USERNAME_FILE}}"
: "${POSTGRES_PASSWORD_FILE:=${KONDIS_DB_PASSWORD_FILE}}"
: "${POSTGRES_DB_FILE:=${KONDIS_DB_DATABASE_NAME_FILE}}"

POSTGRES_DB=$(read_env_or_file "POSTGRES_DB")
POSTGRES_USER=$(read_env_or_file "POSTGRES_USER")
POSTGRES_PASSWORD=$(read_env_or_file "POSTGRES_PASSWORD")

: "${POSTGRES_USER:=${KONDIS_DB_USERNAME}}"
: "${POSTGRES_PASSWORD:=${KONDIS_DB_PASSWORD}}"
: "${POSTGRES_DB:=${KONDIS_DB_DATABASE_NAME}}"

unset POSTGRES_USER_FILE
unset POSTGRES_PASSWORD_FILE
unset POSTGRES_DB_FILE

export POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD
