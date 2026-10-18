# Small image: just the one program, no operating system inside.
FROM --platform=$BUILDPLATFORM golang:1.24 AS build
ARG TARGETOS TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /out/roadtrip-games .

FROM scratch
COPY --from=build /out/roadtrip-games /roadtrip-games
# The game history lives in /data; keep it on a volume so it survives updates.
ENV ROADTRIP_DATA=/data
# Set ROADTRIP_HOSTS to the address the iPad uses to reach the Docker machine, so
# the secure address's certificate covers it (the container can't see it itself).
VOLUME /data
EXPOSE 8070/tcp 8443/tcp
ENTRYPOINT ["/roadtrip-games", "-no-browser"]
