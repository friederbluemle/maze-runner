FROM node:6.4.0

RUN apt-get update && apt-get install -y git

WORKDIR /tools

# Install cmake v3.5 (N.B the version of cmake installed via apt-get is too old)
RUN wget https://cmake.org/files/v3.5/cmake-3.5.0-Linux-x86_64.tar.gz
RUN tar xzf cmake-3.5.0-Linux-x86_64.tar.gz
ENV PATH=$PATH:/tools/cmake-3.5.0-Linux-x86_64/bin

WORKDIR /app
ARG GIT_USERNAME
ARG GIT_TOKEN
RUN git clone https://$GIT_USERNAME:$GIT_TOKEN@github.com/bugsnag/bugsnag-dsym.git

WORKDIR /app/bugsnag-dsym
RUN npm i
RUN npm i -g coffeescript
RUN cake compile

WORKDIR /app/

COPY . .

RUN npm i

CMD node index.js