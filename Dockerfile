# Node.js 버전 지정
FROM node:18-alpine

# 필요한 시스템 패키지 설치
RUN apk add --no-cache sqlite python3 make g++ git

# 작업 디렉토리 생성
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm install --production

# 소스 코드 복사
COPY . .

# 포트 설정
EXPOSE 3000

# 환경 변수 설정
ENV NODE_ENV=production
ENV PORT=3000

# 애플리케이션 실행
CMD ["node", "server.js"] 