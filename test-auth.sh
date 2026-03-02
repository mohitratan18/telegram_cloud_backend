#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:5000"

echo -e "${YELLOW}🧪 Testing Authentication System${NC}\n"

# Test 1: Login with correct credentials
echo -e "${YELLOW}Test 1: Login with correct credentials${NC}"
read -p "Enter username (default: admin): " USERNAME
USERNAME=${USERNAME:-admin}
read -sp "Enter password: " PASSWORD
echo ""

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Login successful${NC}"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    echo -e "Token: ${TOKEN:0:50}...\n"
else
    echo -e "${RED}❌ Login failed${NC}"
    echo "$LOGIN_RESPONSE"
    exit 1
fi

# Test 2: Verify token
echo -e "${YELLOW}Test 2: Verify token${NC}"
VERIFY_RESPONSE=$(curl -s "$API_URL/verify" \
  -H "Authorization: Bearer $TOKEN")

if echo "$VERIFY_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Token verification successful${NC}\n"
else
    echo -e "${RED}❌ Token verification failed${NC}"
    echo "$VERIFY_RESPONSE"
    exit 1
fi

# Test 3: Access protected route (images)
echo -e "${YELLOW}Test 3: Access protected route (/images)${NC}"
IMAGES_RESPONSE=$(curl -s "$API_URL/images?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN")

if echo "$IMAGES_RESPONSE" | grep -q "total"; then
    echo -e "${GREEN}✅ Protected route access successful${NC}\n"
else
    echo -e "${RED}❌ Protected route access failed${NC}"
    echo "$IMAGES_RESPONSE"
fi

# Test 4: Access without token (should fail)
echo -e "${YELLOW}Test 4: Access without token (should fail)${NC}"
NO_TOKEN_RESPONSE=$(curl -s "$API_URL/images")

if echo "$NO_TOKEN_RESPONSE" | grep -q "Unauthorized"; then
    echo -e "${GREEN}✅ Correctly blocked unauthorized access${NC}\n"
else
    echo -e "${RED}❌ Security issue: Unauthorized access allowed${NC}"
    echo "$NO_TOKEN_RESPONSE"
fi

# Test 5: Logout
echo -e "${YELLOW}Test 5: Logout${NC}"
LOGOUT_RESPONSE=$(curl -s -X POST "$API_URL/logout" \
  -H "Authorization: Bearer $TOKEN")

if echo "$LOGOUT_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Logout successful${NC}\n"
else
    echo -e "${RED}❌ Logout failed${NC}"
    echo "$LOGOUT_RESPONSE"
fi

# Test 6: Try to use revoked token (should fail)
echo -e "${YELLOW}Test 6: Try to use revoked token (should fail)${NC}"
REVOKED_RESPONSE=$(curl -s "$API_URL/images" \
  -H "Authorization: Bearer $TOKEN")

if echo "$REVOKED_RESPONSE" | grep -q "Unauthorized"; then
    echo -e "${GREEN}✅ Correctly blocked revoked token${NC}\n"
else
    echo -e "${RED}❌ Security issue: Revoked token still works${NC}"
    echo "$REVOKED_RESPONSE"
fi

# Test 7: Login with wrong credentials (should fail)
echo -e "${YELLOW}Test 7: Login with wrong credentials (should fail)${NC}"
WRONG_LOGIN=$(curl -s -X POST "$API_URL/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrongpassword"}')

if echo "$WRONG_LOGIN" | grep -q "Invalid credentials"; then
    echo -e "${GREEN}✅ Correctly rejected wrong credentials${NC}\n"
else
    echo -e "${RED}❌ Security issue: Wrong credentials accepted${NC}"
    echo "$WRONG_LOGIN"
fi

echo -e "${GREEN}🎉 All tests completed!${NC}"
